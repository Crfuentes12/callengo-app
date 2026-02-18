// app/api/bland/twilio/import-numbers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { numbers, encrypted_key } = await request.json();

    if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
      return NextResponse.json(
        { error: 'At least one phone number is required' },
        { status: 400 }
      );
    }

    if (!encrypted_key) {
      return NextResponse.json(
        { error: 'Twilio encrypted key is required' },
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

    // Import numbers via Bland AI inbound insert endpoint
    const response = await fetch('https://api.bland.ai/v1/inbound/insert', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'encrypted_key': encrypted_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ numbers }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || data.error || 'Failed to import numbers' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      inserted: data.inserted || numbers,
      message: data.message || 'Numbers imported successfully',
    });
  } catch (error: any) {
    console.error('Twilio import numbers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
