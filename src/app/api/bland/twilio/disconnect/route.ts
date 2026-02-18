// app/api/bland/twilio/disconnect/route.ts
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

    const { encrypted_key } = await request.json();

    if (!encrypted_key) {
      return NextResponse.json(
        { error: 'Encrypted key is required' },
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
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
