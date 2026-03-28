// app/api/voices/sample/route.ts
// Voice sample generation with global caching, rate limiting, and cost tracking.
// Uses Bland AI /v1/speak (replaces deprecated /v1/voices/{id}/sample).

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getVoiceSample, GenerationLimitError } from '@/lib/bland/tts';
import { BLAND_VOICES } from '@/lib/voices/bland-voices';

export async function POST(request: NextRequest) {
  try {
    const { voiceId, text, language: _language } = await request.json();

    if (!voiceId || !text) {
      return NextResponse.json(
        { error: 'Voice ID and text are required' },
        { status: 400 }
      );
    }

    // Look up voice name for logging
    const voice = BLAND_VOICES.find(v => v.id === voiceId);
    const voiceName = voice?.name || 'Unknown';

    // Get current user context (optional — unauthenticated preview is allowed but limited)
    let companyId: string | null = null;
    let userId: string | null = null;

    try {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        const { data: userData } = await supabase
          .from('users')
          .select('company_id')
          .eq('id', user.id)
          .single();
        companyId = userData?.company_id || null;
      }
    } catch {
      // Unauthenticated — proceed with null company/user (cache still works)
    }

    // Get voice sample (checks cache → generates if needed → caches → logs cost)
    const result = await getVoiceSample({
      voiceId,
      voiceName,
      text,
      companyId,
      userId,
    });

    return new NextResponse(result.audio, {
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'public, max-age=604800', // 7 days (samples are immutable)
        'X-Voice-Cache': result.fromCache ? 'HIT' : 'MISS',
        'X-Voice-Cost': result.cost.toString(),
      },
    });
  } catch (error) {
    if (error instanceof GenerationLimitError) {
      return NextResponse.json(
        { error: 'Voice sample generation limit reached. All samples should be cached — please try again.', used: error.used, limit: error.limit },
        { status: 429 }
      );
    }

    console.error('Error generating voice sample:', error);
    return NextResponse.json(
      { error: 'Failed to generate voice sample' },
      { status: 500 }
    );
  }
}
