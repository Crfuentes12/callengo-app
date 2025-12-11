// app/api/bland/analyze-call/route.ts
import { NextRequest, NextResponse } from 'next/server';

interface CallAnalysisResult {
  verifiedAddress: string | null;
  contactName: string | null;
  verifiedEmail: string | null;
  businessConfirmed: boolean;
  outcomeNotes: string;
  callSentiment: 'positive' | 'neutral' | 'negative';
  customerInterestLevel: 'high' | 'medium' | 'low' | 'none';
  callCategory: 'successful' | 'partial' | 'callback_needed' | 'wrong_number' | 'not_interested' | 'voicemail' | 'no_answer';
  keyPoints: string[];
  followUpRequired: boolean;
  followUpReason: string | null;
}

const analysisSchema = {
  type: "object" as const,
  properties: {
    verifiedAddress: { type: ["string", "null"] as const },
    contactName: { type: ["string", "null"] as const },
    verifiedEmail: { type: ["string", "null"] as const },
    businessConfirmed: { type: "boolean" as const },
    outcomeNotes: { type: "string" as const },
    callSentiment: { type: "string" as const, enum: ["positive", "neutral", "negative"] },
    customerInterestLevel: { type: "string" as const, enum: ["high", "medium", "low", "none"] },
    callCategory: { 
      type: "string" as const, 
      enum: ["successful", "partial", "callback_needed", "wrong_number", "not_interested", "voicemail", "no_answer"] 
    },
    keyPoints: { type: "array" as const, items: { type: "string" as const } },
    followUpRequired: { type: "boolean" as const },
    followUpReason: { type: ["string", "null"] as const },
  },
  required: [
    "verifiedAddress", "contactName", "verifiedEmail", "businessConfirmed", 
    "outcomeNotes", "callSentiment", "customerInterestLevel", "callCategory",
    "keyPoints", "followUpRequired", "followUpReason"
  ],
  additionalProperties: false
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, companyName, companyId } = body;

    if (!transcript) {
      return NextResponse.json({ error: 'transcript is required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const systemPrompt = `You are an expert call analyst. Analyze phone call transcripts and extract key information.

IMPORTANT RULES:
- contactName should ONLY be the CUSTOMER's name, never the AI agent's name
- Agent names to exclude: Maya, Josh, Matt, Natalie, Nat, Jen
- Only mark businessConfirmed as true if customer explicitly confirms
- Extract email addresses exactly as stated
- Be conservative - if information is unclear, use null`;

    const userPrompt = `Analyze this phone call transcript${companyName ? ` for ${companyName}` : ''}:

${transcript}

Extract all relevant information accurately.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'call_analysis',
            strict: true,
            schema: analysisSchema
          }
        },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis: CallAnalysisResult = JSON.parse(data.choices[0].message.content);

    return NextResponse.json({
      status: 'success',
      analysis,
    });

  } catch (error) {
    console.error('Error in analyze-call route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}