// app/api/bland/get-call/[callId]/route.ts
// Single master API key — call details fetched via master key
// Company ownership verified via call_logs.company_id in Supabase
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { getCallDetails } from '@/lib/bland/master-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const companyId = request.nextUrl.searchParams.get('company_id');

    if (!callId || !companyId) {
      return NextResponse.json(
        { error: 'Call ID and company_id are required' },
        { status: 400 }
      );
    }

    // MEDIA-003: Verify authentication and company ownership to prevent IDOR
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify this call belongs to the company (prevents cross-company access)
    const { data: callLog } = await supabaseAdmin
      .from('call_logs')
      .select('id')
      .eq('call_id', callId)
      .eq('company_id', companyId)
      .maybeSingle();

    if (!callLog) {
      return NextResponse.json(
        { error: 'Call not found or does not belong to this company' },
        { status: 404 }
      );
    }

    // Fetch from Bland via master key
    const data = await getCallDetails(callId);

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to fetch call details from Bland' },
        { status: 502 }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in get-call route:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
