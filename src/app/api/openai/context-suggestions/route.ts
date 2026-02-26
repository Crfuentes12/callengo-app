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

    const prompt = `You are helping a user create campaign context for an AI calling agent.

AGENT TYPE: ${agentType}
${companyContext ? `\nCOMPANY INFO:\n${companyContext}` : ''}

Generate exactly 3 campaign context suggestions. Each suggestion has:
- A SHORT catchy title (2-4 words max) that describes the campaign context like a label. Examples: "ISO Appointment", "Website Lead", "Chicago Clinic", "Surgeon Follow-up", "Pending Credits", "Annual Checkup", "Demo Request", "Trial Expired"
- A detailed context paragraph (2-4 sentences) that the AI agent will use during calls. This is the actual instruction text.

The title should be industry-specific and instantly recognizable. The detail should be a complete, actionable instruction for the AI agent.

${agentType === 'appointment_confirmation' ? 'Focus on appointment types, clinic/office details, policies, locations.' : ''}
${agentType === 'lead_qualification' ? 'Focus on lead sources, product tiers, qualification criteria, deal stages.' : ''}
${agentType === 'data_validation' ? 'Focus on data fields to verify, compliance notes, update procedures.' : ''}

Respond in JSON format:
{ "suggestions": [{ "title": "Short Title", "detail": "Detailed context paragraph..." }, ...] }`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800,
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
