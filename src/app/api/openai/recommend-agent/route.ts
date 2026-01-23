// app/api/openai/recommend-agent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userInput, availableAgents } = await request.json();

    if (!userInput || !availableAgents || !Array.isArray(availableAgents)) {
      return NextResponse.json(
        { error: 'User input and available agents are required' },
        { status: 400 }
      );
    }

    // Build agents list for the prompt
    const agentsText = availableAgents
      .map((agent: any, index: number) =>
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

    // Validate that the recommended slug exists
    const isValid = availableAgents.some((agent: any) => agent.slug === recommendedSlug);

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
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
