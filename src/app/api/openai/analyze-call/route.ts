// app/api/openai/analyze-call/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { expensiveLimiter } from '@/lib/rate-limit';
import { getOpenAIClient, trackOpenAIUsage, getDefaultModel } from '@/lib/openai/tracker';

const openai = getOpenAIClient('demo_analysis');

export async function POST(request: NextRequest) {
  try {
    // Auth check — prevent unauthenticated access to OpenAI API
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit: 5 analysis requests per minute per user (each triggers OpenAI API call)
    const rateLimit = await expensiveLimiter.check(5, `openai_analyze_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many analysis requests. Please wait.' }, { status: 429 });
    }

    const { transcripts, agentType: _agentType, demoData } = await request.json();

    if (!transcripts || !Array.isArray(transcripts)) {
      return NextResponse.json(
        { error: 'Transcripts array is required' },
        { status: 400 }
      );
    }

    // Build conversation text from transcripts
    const conversationText = transcripts
      .map((t: Record<string, unknown>) => {
        const speaker = t.user === 'assistant' ? 'Agent' : 'Customer';
        return `${speaker}: ${t.text}`;
      })
      .join('\n');

    // Build demo data context
    const demoDataText = Object.entries(demoData || {})
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    // Create analysis prompt
    const prompt = `You are analyzing a call made by an AI agent. Below is the conversation transcript and the demo data that was supposed to be used/validated during the call.

DEMO DATA PROVIDED:
${demoDataText}

CONVERSATION TRANSCRIPT:
${conversationText}

Your task is to EXTRACT and STRUCTURE all relevant information from the call. DO NOT just summarize - extract actionable data.

Please analyze this call and provide:
1. **Extracted Data**: All specific data points mentioned by the customer (name, email, phone, company, preferences, needs, etc.)
2. **Validated Fields**: Which fields from the demo data were confirmed/validated during the call (mark as "Confirmed" or "Updated" with new value)
3. **New Information**: Any NEW data collected that wasn't in the demo data
4. **Call Outcome**: What was accomplished (meeting scheduled, interested/not interested, callback needed, etc.)
5. **Next Actions**: Specific follow-up tasks based on the conversation
6. **Call Quality**: Overall success rating (1-10) and brief reason

Format your response as JSON with this EXACT structure:
{
  "extractedData": {
    "fieldName": "actual value mentioned in call",
    "anotherField": "another value"
  },
  "validatedFields": {
    "fieldName": "Confirmed" or "Updated: new value"
  },
  "newInformation": {
    "fieldName": "value"
  },
  "outcome": "Brief outcome (e.g., 'Interested in product, wants demo', 'Not interested', 'Scheduled follow-up')",
  "nextActions": [
    "Specific action item 1",
    "Specific action item 2"
  ],
  "callQuality": {
    "rating": 8,
    "reason": "Brief reason for rating"
  }
}

IMPORTANT: Extract ACTUAL data from the conversation. If the customer mentioned their email is "john@company.com", put that exact email. If they said they have 50 employees, put "50". Be specific and actionable.`;

    const completion = await openai.chat.completions.create({
      model: getDefaultModel(),
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing sales and customer service calls. Provide concise, actionable insights in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const analysisText = completion.choices[0].message.content;
    const analysis = JSON.parse(analysisText || '{}');

    // Fetch companyId for tracking (non-blocking)
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
          metadata: { endpoint: 'openai/analyze-call' },
        });
      } catch {
        trackOpenAIUsage({
          featureKey: 'demo_analysis',
          model: getDefaultModel(),
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          companyId: null,
          userId: user.id,
          metadata: { endpoint: 'openai/analyze-call' },
        });
      }
    })();

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('Error analyzing call:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze call',
      },
      { status: 500 }
    );
  }
}
