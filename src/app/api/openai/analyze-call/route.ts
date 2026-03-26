// app/api/openai/analyze-call/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { expensiveLimiter } from '@/lib/rate-limit';
import { getOpenAIClient, trackOpenAIUsage, getDefaultModel } from '@/lib/openai/tracker';

const openai = getOpenAIClient('demo_analysis');

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await expensiveLimiter.check(5, `openai_analyze_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many analysis requests. Please wait.' }, { status: 429 });
    }

    const body = await request.json();

    // Accept both formats: transcripts array (new) or transcript string (legacy)
    const { transcripts, transcript, agentType, agent_type, agent_slug, demoData, call_duration } = body;

    // Build conversation text
    let conversationText = '';
    if (Array.isArray(transcripts) && transcripts.length > 0) {
      conversationText = transcripts
        .map((t: Record<string, unknown>) => {
          const speaker = t.user === 'assistant' ? 'Agent' : 'Customer';
          return `${speaker}: ${t.text}`;
        })
        .join('\n');
    } else if (typeof transcript === 'string' && transcript.trim()) {
      conversationText = transcript;
    }

    if (!conversationText) {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      );
    }

    const resolvedAgentType = agentType || agent_type || 'unknown';
    const resolvedAgentSlug = agent_slug || 'unknown';

    const demoDataText = Object.entries(demoData || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // Agent-specific instructions for structured extraction
    const agentSpecificInstructions: Record<string, string> = {
      'appointment-confirmation': `
For this appointment confirmation agent, extract:
- "appointmentStatus": was the appointment "confirmed", "rescheduled", or "cancelled"?
- "newDay": if rescheduled, what day of the week did the customer request? (e.g. "Wednesday", "Thursday", "Next Monday")
- "newTime": if rescheduled, what time? (e.g. "2:00 PM", "10:00 AM") — default to original time if not mentioned
- "originalDay": what was the original appointment day? (e.g. "Tuesday")
- "rescheduleReason": brief reason the customer gave for rescheduling, or null if confirmed
`,
      'data-validation': `
For this data validation agent, extract:
- "updatedFields": array of { "field": "Email", "oldValue": "old@email.com", "newValue": "new@email.com" } for each field that was corrected
- "confirmedFields": array of field names that were verified as correct (e.g. ["Phone", "Company"])
- "newFields": any new information collected not in the original data
`,
      'lead-qualification': `
For this lead qualification agent using BANT framework, extract:
- "bantScores": { "budget": 0-100, "authority": 0-100, "need": 0-100, "timeline": 0-100 } — score each dimension based on what the customer shared
- "bantNotes": { "budget": "brief note", "authority": "brief note", "need": "brief note", "timeline": "brief note" }
- "leadTemperature": "hot" (score > 75), "warm" (50-75), or "cold" (< 50)
- "recommendedAction": what should the sales team do next?
`,
    };

    const agentInstruction = agentSpecificInstructions[resolvedAgentSlug] || '';

    const prompt = `You are analyzing a demo call made by an AI agent (${resolvedAgentType}).

DEMO DATA (what the agent was working with):
${demoDataText || 'N/A'}

CONVERSATION TRANSCRIPT:
${conversationText}

${agentInstruction ? `AGENT-SPECIFIC EXTRACTION:\n${agentInstruction}` : ''}

Analyze this call and return a JSON object with this EXACT structure:
{
  "sentiment": "positive" | "neutral" | "negative",
  "callScore": <integer 0-100 reflecting overall call success>,
  "summary": "<2-3 sentence summary of what happened>",
  "key_points": ["<key insight 1>", "<key insight 2>", "<key insight 3>"],
  "outcome": "<what was accomplished>",
  "nextActions": ["<specific follow-up 1>", "<specific follow-up 2>"],
  "agentSpecific": {
    <agent-specific fields as described above — include ALL fields even if estimating>
  }
}

IMPORTANT:
- Base ALL data on what was ACTUALLY said in the transcript. Do not invent specifics.
- If a field cannot be determined from the transcript, use null.
- callScore: 90-100 = exceptional, 70-89 = successful, 50-69 = partial, below 50 = poor.
- Be concise and actionable.`;

    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: getDefaultModel(),
        messages: [
          {
            role: 'system',
            content: 'You are an expert at analyzing AI agent calls. Extract structured, actionable data from transcripts. Always return valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });
    } catch (openaiError) {
      // OpenAI error (auth, quota, network) — return a 200 with empty analysis
      // so the frontend can still display the call without crashing.
      console.error('OpenAI call failed in analyze-call:', openaiError);
      return NextResponse.json({ success: false, analysis: null, error: 'analysis_unavailable' });
    }

    const analysisText = completion.choices[0].message.content;
    const analysis = JSON.parse(analysisText || '{}');

    // Non-blocking usage tracking
    void (async () => {
      try {
        const { data: ud } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', user.id)
          .single();
        trackOpenAIUsage({
          featureKey: 'demo_analysis',
          model: getDefaultModel(),
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          companyId: (ud as { company_id: string } | null)?.company_id ?? null,
          userId: user.id,
          metadata: { endpoint: 'openai/analyze-call', agent_slug: resolvedAgentSlug },
        });
      } catch {
        trackOpenAIUsage({
          featureKey: 'demo_analysis',
          model: getDefaultModel(),
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          companyId: null,
          userId: user.id,
          metadata: { endpoint: 'openai/analyze-call', agent_slug: resolvedAgentSlug },
        });
      }
    })();

    return NextResponse.json({ success: true, analysis, call_duration });

  } catch (error) {
    console.error('Error analyzing call:', error);
    return NextResponse.json({ error: 'Failed to analyze call' }, { status: 500 });
  }
}
