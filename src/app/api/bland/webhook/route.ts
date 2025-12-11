// app/api/bland/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      call_id,
      status,
      completed,
      call_length,
      to,
      from,
      answered_by,
      recording_url,
      concatenated_transcript,
      summary,
      error_message,
      price,
      metadata,
    } = body;

    console.log('Webhook received for call:', call_id);

    // Extract company_id and contact_id from metadata
    const companyId = metadata?.company_id;
    const contactId = metadata?.contact_id;

    if (!companyId) {
      console.error('No company_id in webhook metadata');
      return NextResponse.json({ error: 'Missing company_id' }, { status: 400 });
    }

    // Log the call
    await supabaseAdmin.from('call_logs').insert({
      company_id: companyId,
      contact_id: contactId || null,
      call_id,
      status,
      completed: completed || false,
      call_length,
      price,
      answered_by,
      recording_url,
      transcript: concatenated_transcript,
      summary,
      error_message,
      metadata: body,
    });

    // If there's a contact_id, update the contact
    if (contactId && completed) {
      const updates: Record<string, unknown> = {
        call_status: status,
        call_duration: call_length,
        recording_url,
        transcript_text: concatenated_transcript,
        updated_at: new Date().toISOString(),
      };

      // Add call metadata
      if (answered_by) {
        updates.call_metadata = {
          price,
          answered_by,
          from,
          to,
          summary,
          error_message,
        };
      }

      await supabaseAdmin
        .from('contacts')
        .update(updates)
        .eq('id', contactId);
    }

    return NextResponse.json({
      status: 'success',
      message: 'Webhook processed',
      call_id,
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Bland AI webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}