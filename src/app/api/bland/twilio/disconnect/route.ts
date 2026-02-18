// app/api/bland/twilio/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { encrypted_key } = await request.json();

    if (!encrypted_key) {
      return NextResponse.json(
        { error: 'Encrypted key is required' },
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

    // Delete encrypted key via Bland AI
    const response = await fetch('https://api.bland.ai/v1/accounts/delete', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'encrypted_key': encrypted_key,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to disconnect Twilio account' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      message: 'Twilio account disconnected successfully',
    });
  } catch (error: any) {
    console.error('Twilio disconnect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
