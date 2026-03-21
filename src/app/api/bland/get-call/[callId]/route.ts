// app/api/bland/get-call/[callId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

    const { data: settings } = await supabase
      .from('company_settings')
      .select('bland_api_key')
      .eq('company_id', companyId)
      .single();

    // Never fall back to master API key — would leak cross-company data
    if (!settings?.bland_api_key) {
      return NextResponse.json(
        { error: 'Bland sub-account not configured for this company. Please contact support.' },
        { status: 500 }
      );
    }
    const apiKey = settings.bland_api_key;

    const response = await fetch(`https://api.bland.ai/v1/calls/${callId}`, {
      method: 'GET',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to fetch call details' },
        { status: response.status }
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