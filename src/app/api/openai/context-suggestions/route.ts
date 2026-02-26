// app/api/openai/context-suggestions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { agentType, companyName, companyDescription, companyWebsite } = await request.json();

    if (!agentType) {
      return NextResponse.json(
        { error: 'Agent type is required' },
        { status: 400 }
      );
    }

    const companyContext = [
      companyName && `Company: ${companyName}`,
      companyDescription && `Description: ${companyDescription}`,
      companyWebsite && `Website: ${companyWebsite}`,
    ].filter(Boolean).join('\n');

    const prompt = `You are helping a user write campaign context instructions for an AI calling agent.

AGENT TYPE: ${agentType}
${companyContext ? `\nCOMPANY INFO:\n${companyContext}` : ''}

Generate exactly 3 short, specific campaign context suggestions that would help the AI agent perform better calls. Each suggestion should be a complete, ready-to-use context paragraph (2-3 sentences max) that the user can click to auto-fill.

The suggestions should be different approaches:
1. A professional/formal tone context
2. A friendly/casual tone context
3. A detailed/specific context with example data points

${agentType === 'appointment_confirmation' ? 'Focus on appointment details, cancellation policies, rescheduling options, location info.' : ''}
${agentType === 'lead_qualification' ? 'Focus on qualifying criteria, product/service details, ideal customer profile, budget ranges.' : ''}
${agentType === 'data_validation' ? 'Focus on which data fields to verify, privacy notices, what to do with updated information.' : ''}

Respond in JSON format:
{ "suggestions": ["suggestion1", "suggestion2", "suggestion3"] }

Keep each suggestion under 150 characters. Make them specific and actionable, not generic.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ suggestions: [] });
    }

    const parsed = JSON.parse(content);
    return NextResponse.json({ suggestions: parsed.suggestions || [] });
  } catch (error) {
    console.error('Error generating context suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
