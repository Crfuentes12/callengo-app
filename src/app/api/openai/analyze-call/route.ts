// app/api/openai/analyze-call/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcripts, agentType, demoData } = await request.json();

    if (!transcripts || !Array.isArray(transcripts)) {
      return NextResponse.json(
        { error: 'Transcripts array is required' },
        { status: 400 }
      );
    }

    // Build conversation text from transcripts
    const conversationText = transcripts
      .map((t: any) => {
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

Please analyze this call and provide:
1. A brief summary of what happened during the call (2-3 sentences)
2. Which data points from the demo data were successfully validated or mentioned
3. Any important notes or observations about the call quality, customer engagement, or outcomes
4. Overall call success rating (1-10)

Format your response as JSON with this structure:
{
  "summary": "Brief summary here...",
  "validatedData": {
    "fieldName": "validated value or status"
  },
  "notes": "Important observations...",
  "successRating": 8
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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

    return NextResponse.json({
      success: true,
      analysis,
    });

  } catch (error) {
    console.error('Error analyzing call:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze call',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
