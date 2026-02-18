// app/api/bland/phone-numbers/purchase/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { area_code, type = 'outbound' } = await request.json();

    if (!area_code || area_code.length !== 3) {
      return NextResponse.json(
        { error: 'A valid 3-digit area code is required' },
        { status: 400 }
      );
    }

    // Get the company's Bland AI API key and verify plan
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check plan allows phone number purchase
    const { data: subscription } = await supabase
      .from('company_subscriptions')
      .select('subscription_plans(slug)')
      .eq('company_id', userData.company_id)
      .eq('status', 'active')
      .single();

    const planSlug = (subscription?.subscription_plans as any)?.slug;
    if (planSlug === 'free') {
      return NextResponse.json(
        { error: 'Phone number purchase is not available on the Free plan. Please upgrade to Starter or above.' },
        { status: 403 }
      );
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

    // Purchase phone number via Bland AI
    const endpoint = type === 'inbound'
      ? 'https://api.bland.ai/v1/inbound/purchase'
      : 'https://api.bland.ai/v1/outbound/purchase';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ area_code }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to purchase phone number' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      phone_number: data.phone_number,
      type,
      message: `Phone number ${data.phone_number} purchased successfully ($15/month)`,
    });
  } catch (error: any) {
    console.error('Phone number purchase error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
