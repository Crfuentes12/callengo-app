// app/api/bland/twilio/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
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

    // Get company_id from user (using admin to bypass RLS)
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get company-specific API key or use default
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('bland_api_key')
      .eq('company_id', userData.company_id)
      .single();

    const apiKey = companySettings?.bland_api_key || process.env.BLAND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Bland AI API key not configured. Please add BLAND_API_KEY to your environment variables.' },
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
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
