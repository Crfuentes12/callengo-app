// app/api/bland/call-status/route.ts
// Lightweight call status polling for test/onboarding calls.
// Unlike get-call/[callId], this does NOT require a call_logs entry —
// test calls bypass the billing pipeline and are never pre-registered there.
// Security: requires authenticated session only.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getCallDetails } from '@/lib/bland/master-client';

export async function GET(request: NextRequest) {
  try {
    const callId = request.nextUrl.searchParams.get('call_id');

    if (!callId) {
      return NextResponse.json({ error: 'call_id is required' }, { status: 400 });
    }

    // Require authenticated session
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getCallDetails(callId);

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to fetch call status from Bland' },
        { status: 502 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('[call-status] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
