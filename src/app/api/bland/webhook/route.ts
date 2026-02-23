// app/api/bland/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { createAgentCallback, createAgentFollowUp } from '@/lib/calendar/sync';

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

    // ================================================================
    // CALENDAR INTEGRATION: Create calendar events based on call outcome
    // ================================================================
    try {
      const contactName = contactId
        ? await getContactName(contactId)
        : to || 'Unknown';

      // If call was not answered or voicemail, schedule a callback event
      if (answered_by === 'voicemail' || status === 'no_answer' || status === 'voicemail') {
        const callbackDate = new Date();
        callbackDate.setDate(callbackDate.getDate() + 1);
        callbackDate.setHours(10, 0, 0, 0);

        await createAgentCallback(companyId, {
          contactId: contactId || undefined,
          contactName,
          contactPhone: to || undefined,
          callbackDate: callbackDate.toISOString(),
          agentName: metadata?.agent_name || 'AI Agent',
          reason: answered_by === 'voicemail' ? 'voicemail' : 'no_answer',
          notes: summary || `Auto-scheduled callback after ${answered_by === 'voicemail' ? 'voicemail' : 'no answer'}`,
        });
      }

      // If call completed and follow-up is needed (based on analysis/metadata)
      if (completed && metadata?.follow_up_needed) {
        const followUpDate = metadata?.follow_up_date
          ? new Date(metadata.follow_up_date)
          : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // Default 3 days

        await createAgentFollowUp(companyId, {
          contactId: contactId || undefined,
          contactName,
          contactPhone: to || undefined,
          agentName: metadata?.agent_name || 'AI Agent',
          followUpDate: followUpDate.toISOString(),
          reason: metadata?.follow_up_reason || 'Follow-up scheduled after call',
          notes: summary || undefined,
        });
      }

      // If call completed successfully, log it as a completed event
      if (completed && status === 'completed') {
        const callStart = new Date(metadata?.started_at || new Date());
        const callEnd = new Date(callStart);
        callEnd.setSeconds(callEnd.getSeconds() + (call_length || 0));

        await supabaseAdmin.from('calendar_events').insert({
          company_id: companyId,
          title: `Call Completed: ${contactName}`,
          description: summary || `Outbound call to ${contactName}`,
          start_time: callStart.toISOString(),
          end_time: callEnd.toISOString(),
          event_type: 'call',
          status: 'completed',
          source: 'campaign',
          contact_id: contactId || null,
          contact_name: contactName,
          contact_phone: to || null,
          agent_name: metadata?.agent_name || null,
          ai_notes: summary || null,
          confirmation_status: 'confirmed',
          metadata: {
            call_id,
            call_length,
            answered_by,
            recording_url,
          },
        });
      }
    } catch (calendarError) {
      // Don't fail the webhook if calendar event creation fails
      console.error('Failed to create calendar event (non-fatal):', calendarError);
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

async function getContactName(contactId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('contacts')
    .select('contact_name, phone_number')
    .eq('id', contactId)
    .maybeSingle();
  return data?.contact_name || data?.phone_number || 'Unknown';
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Bland AI webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}