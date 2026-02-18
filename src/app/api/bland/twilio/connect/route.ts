// app/api/bland/twilio/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { account_sid, auth_token } = await request.json();

    if (!account_sid || !auth_token) {
      return NextResponse.json(
        { error: 'Twilio Account SID and Auth Token are required' },
        { status: 400 }
      );
    }

    // Get the company's Bland AI API key
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: companySettings } = await supabase
      .from('company_settings')
      .select('bland_api_key')
      .eq('company_id', userData.company_id)
      .single();

    const apiKey = companySettings?.bland_api_key || process.env.BLAND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Bland AI API key not configured' },
        { status: 500 }
      );
    }

    // Generate encrypted key via Bland AI accounts endpoint
    const response = await fetch('https://api.bland.ai/v1/accounts', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_sid,
        auth_token,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to connect Twilio account' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      encrypted_key: data.encrypted_key,
      message: 'Twilio account connected successfully',
    });
  } catch (error: any) {
    console.error('Twilio connect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
