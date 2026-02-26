// app/api/bland/send-call/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      phone_number,
      task,
      voice = 'maya',
      first_sentence,
      wait_for_greeting = true,
      record = true,
      max_duration = 5,
      voicemail_action = 'leave_message',
      voicemail_message,
      answered_by_enabled = true,
      webhook,
      metadata,
      company_id,
    } = body;

    if (!phone_number || !task || !company_id) {
      return NextResponse.json(
        { error: 'phone_number, task, and company_id are required' },
        { status: 400 }
      );
    }

    // Verify user belongs to the specified company
    const { data: userData } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (!userData || userData.company_id !== company_id) {
      return NextResponse.json({ error: 'Unauthorized for this company' }, { status: 403 });
    }

    // Get company-specific API key or use default
    const { data: settings } = await supabaseAdmin
      .from('company_settings')
      .select('bland_api_key')
      .eq('company_id', company_id)
      .single();

    const apiKey = settings?.bland_api_key || process.env.BLAND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Bland API key not configured' },
        { status: 500 }
      );
    }

    const blandPayload: Record<string, unknown> = {
      phone_number,
      task,
      voice,
      wait_for_greeting,
      record,
      max_duration,
      voicemail_action,
      answered_by_enabled,
      model: 'enhanced',
      language: 'en',
      temperature: 0.7,
      background_track: 'office',
    };

    if (first_sentence) blandPayload.first_sentence = first_sentence;
    if (voicemail_message) blandPayload.voicemail_message = voicemail_message;
    if (webhook && webhook.startsWith('https://')) blandPayload.webhook = webhook;
    if (metadata) blandPayload.metadata = metadata;

    const response = await fetch('https://api.bland.ai/v1/calls', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blandPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to initiate call', details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      status: 'success',
      call_id: data.call_id,
      message: data.message || 'Call initiated successfully',
    });

  } catch (error) {
    console.error('Error in send-call route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}