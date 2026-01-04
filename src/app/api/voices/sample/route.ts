// app/api/voices/sample/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { voiceId, text, language } = await request.json();

    if (!voiceId || !text) {
      return NextResponse.json(
        { error: 'Voice ID and text are required' },
        { status: 400 }
      );
    }

    const blandApiKey = process.env.BLAND_API_KEY;
    if (!blandApiKey) {
      return NextResponse.json(
        { error: 'Bland API key not configured' },
        { status: 500 }
      );
    }

    // Call Bland AI API to generate voice sample
    const response = await fetch(`https://api.bland.ai/v1/voices/${voiceId}/sample`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': blandApiKey,
      },
      body: JSON.stringify({
        text,
        language: language || 'ENG',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Bland API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to generate voice sample' },
        { status: response.status }
      );
    }

    // Get the audio blob
    const audioBlob = await response.blob();

    // Return the audio as a response
    return new NextResponse(audioBlob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });
  } catch (error) {
    console.error('Error generating voice sample:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
