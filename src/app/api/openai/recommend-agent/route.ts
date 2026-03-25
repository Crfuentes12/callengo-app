// app/api/openai/recommend-agent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getOpenAIClient, trackOpenAIUsage } from '@/lib/openai/tracker';
import { expensiveLimiter } from '@/lib/rate-limit';

const openai = getOpenAIClient('contact_analysis');

export async function POST(request: NextRequest) {
  try {
    // Auth check — prevent unauthenticated access to OpenAI API
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rateLimit = await expensiveLimiter.check(5, `recommend_agent_${user.id}`);
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { userInput, availableAgents } = await request.json();

    if (!userInput || !availableAgents || !Array.isArray(availableAgents)) {
      return NextResponse.json(
        { error: 'User input and available agents are required' },
        { status: 400 }
      );
    }

    // Build agents list for the prompt
    const agentsText = availableAgents
      .map((agent: Record<string, unknown>, index: number) =>
        `${index + 1}. **${agent.name}** (${agent.slug})\n   ${agent.description}`
      )
      .join('\n\n');

    const prompt = `You are an AI assistant helping a user choose the best AI agent for their business needs.

USER'S CHALLENGE:
"${userInput}"

AVAILABLE AGENTS:
${agentsText}

Based on the user's challenge, recommend the MOST APPROPRIATE agent. Consider:
- The specific pain point or problem mentioned
- The primary task or goal
- Keywords that indicate data quality issues, appointment/scheduling needs, or lead qualification

Respond with ONLY the agent's slug (e.g., "data-validation", "appointment-confirmation", or "lead-qualification").
Choose the single best match.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at understanding business problems and matching them to the right automation solutions. Respond with only the agent slug.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 50,
    });

    const recommendedSlug = completion.choices[0].message.content?.trim().replace(/['"]/g, '');

    // Track usage (non-blocking)
    supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()
      .then(({ data: ud }: { data: { company_id: string } | null; error: unknown }) => {
        trackOpenAIUsage({
          featureKey: 'contact_analysis',
          model: 'gpt-4o-mini',
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          companyId: ud?.company_id ?? null,
          userId: user.id,
          metadata: { endpoint: 'openai/recommend-agent' },
        });
      })
      .catch(() => {
        trackOpenAIUsage({
          featureKey: 'contact_analysis',
          model: 'gpt-4o-mini',
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
          companyId: null,
          userId: user.id,
          metadata: { endpoint: 'openai/recommend-agent' },
        });
      });

    // Validate that the recommended slug exists
    const isValid = availableAgents.some((agent: Record<string, unknown>) => agent.slug === recommendedSlug);

    if (!isValid) {
      // Fallback to first agent if recommendation doesn't match
      return NextResponse.json({
        success: true,
        recommendedSlug: availableAgents[0].slug,
      });
    }

    return NextResponse.json({
      success: true,
      recommendedSlug,
    });

  } catch (error) {
    console.error('Error recommending agent:', error);
    return NextResponse.json(
      {
        error: 'Failed to recommend agent',
      },
      { status: 500 }
    );
  }
}
