// app/api/integrations/simplybook/webhook/route.ts
// Bidirectional webhook receiver for SimplyBook.me
// Handles real-time notifications when bookings, clients, or providers change in SimplyBook.
// SimplyBook sends these via their "Webhook Notifications" custom feature.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';
import { dispatchWebhookEvent } from '@/lib/webhooks';

// ============================================================================
// SIMPLYBOOK WEBHOOK EVENT TYPES
// ============================================================================

interface SimplyBookWebhookPayload {
  notification_type: string; // 'create' | 'change' | 'cancel'
  booking_id?: number;
  booking_code?: string;
  client_id?: number;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  service_id?: number;
  service_name?: string;
  provider_id?: number;
  provider_name?: string;
  start_datetime?: string;
  end_datetime?: string;
  status?: string;
  comment?: string;
  company?: string; // sb_company_login
  // Custom fields may also appear
  [key: string]: unknown;
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SimplyBookWebhookPayload;

    // Identify which company this belongs to via company login
    const companyLogin = body.company || request.nextUrl.searchParams.get('company');
    if (!companyLogin) {
      return NextResponse.json({ error: 'Missing company identifier' }, { status: 400 });
    }

    // Look up the integration
    const { data: integration } = await supabaseAdmin
      .from('simplybook_integrations')
      .select('id, company_id, is_active')
      .eq('sb_company_login', companyLogin)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      console.warn(`[simplybook-webhook] No active integration for company: ${companyLogin}`);
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    const companyId = integration.company_id;
    const integrationId = integration.id;

    // Log the webhook
    await supabaseAdmin.from('simplybook_webhook_logs').insert({
      company_id: companyId,
      integration_id: integrationId,
      event_type: body.notification_type || 'unknown',
      payload: body as unknown as Record<string, unknown>,
      processed: false,
    });

    // Process based on notification type
    const notificationType = body.notification_type;

    // ---- BOOKING CREATED ----
    if (notificationType === 'create' && body.booking_id) {
      await handleBookingCreated(companyId, integrationId, body);
    }

    // ---- BOOKING CHANGED (rescheduled, updated) ----
    if (notificationType === 'change' && body.booking_id) {
      await handleBookingChanged(companyId, integrationId, body);
    }

    // ---- BOOKING CANCELLED ----
    if (notificationType === 'cancel' && body.booking_id) {
      await handleBookingCancelled(companyId, integrationId, body);
    }

    // Mark webhook as processed
    await supabaseAdmin
      .from('simplybook_webhook_logs')
      .update({ processed: true })
      .eq('company_id', companyId)
      .eq('event_type', notificationType || 'unknown')
      .is('processed', false)
      .order('created_at', { ascending: false })
      .limit(1);

    return NextResponse.json({ status: 'ok', processed: notificationType });
  } catch (error) {
    console.error('[simplybook-webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

async function handleBookingCreated(
  companyId: string,
  integrationId: string,
  payload: SimplyBookWebhookPayload
): Promise<void> {
  // Find or create the contact
  const contactId = await resolveContact(companyId, integrationId, payload);

  // Create a calendar event in Callengo
  const startTime = payload.start_datetime
    ? new Date(payload.start_datetime).toISOString()
    : new Date().toISOString();
  const endTime = payload.end_datetime
    ? new Date(payload.end_datetime).toISOString()
    : new Date(new Date(startTime).getTime() + 30 * 60000).toISOString();

  const { data: event } = await supabaseAdmin
    .from('calendar_events')
    .insert({
      company_id: companyId,
      title: `${payload.service_name || 'Appointment'}: ${payload.client_name || 'Client'}`,
      description: payload.comment || `Booked via SimplyBook.me`,
      start_time: startTime,
      end_time: endTime,
      event_type: 'appointment',
      status: 'scheduled',
      source: 'webhook',
      contact_id: contactId,
      contact_name: payload.client_name || null,
      contact_phone: payload.client_phone || null,
      contact_email: payload.client_email || null,
      confirmation_status: 'confirmed',
      metadata: {
        simplybook_booking_id: payload.booking_id,
        simplybook_booking_code: payload.booking_code,
        simplybook_service_id: payload.service_id,
        simplybook_service_name: payload.service_name,
        simplybook_provider_id: payload.provider_id,
        simplybook_provider_name: payload.provider_name,
        source_integration: 'simplybook',
      },
    })
    .select('id')
    .single();

  // Auto-assign to provider if team member mapping exists
  if (payload.provider_id && event) {
    const { data: assignment } = await supabaseAdmin
      .from('team_calendar_assignments')
      .select('id, display_name')
      .eq('company_id', companyId)
      .eq('simplybook_provider_id', payload.provider_id)
      .eq('is_active', true)
      .maybeSingle();

    if (assignment) {
      await supabaseAdmin
        .from('calendar_events')
        .update({
          assigned_to: assignment.id,
          assigned_to_name: assignment.display_name,
        })
        .eq('id', event.id);
    }
  }

  // Dispatch outbound webhook
  dispatchWebhookEvent(companyId, 'appointment.scheduled', {
    source: 'simplybook',
    booking_id: payload.booking_id,
    contact_id: contactId,
    contact_name: payload.client_name,
    service: payload.service_name,
    provider: payload.provider_name,
    start_time: startTime,
    end_time: endTime,
  }).catch(err => console.warn('[simplybook-webhook] Outbound dispatch failed:', err?.message));
}

async function handleBookingChanged(
  companyId: string,
  integrationId: string,
  payload: SimplyBookWebhookPayload
): Promise<void> {
  // Find the existing calendar event by SimplyBook booking ID
  const { data: existingEvent } = await supabaseAdmin
    .from('calendar_events')
    .select('id')
    .eq('company_id', companyId)
    .contains('metadata', { simplybook_booking_id: payload.booking_id })
    .maybeSingle();

  if (!existingEvent) {
    // Event doesn't exist locally — create it instead
    await handleBookingCreated(companyId, integrationId, payload);
    return;
  }

  // Update the event
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.start_datetime) updates.start_time = new Date(payload.start_datetime).toISOString();
  if (payload.end_datetime) updates.end_time = new Date(payload.end_datetime).toISOString();
  if (payload.client_name) updates.contact_name = payload.client_name;
  if (payload.service_name) updates.title = `${payload.service_name}: ${payload.client_name || 'Client'}`;
  if (payload.status === 'cancelled') {
    updates.status = 'cancelled';
  } else {
    updates.status = 'rescheduled';
    updates.rescheduled_count = 1; // Will be incremented by trigger
  }

  await supabaseAdmin
    .from('calendar_events')
    .update(updates)
    .eq('id', existingEvent.id);

  dispatchWebhookEvent(companyId, 'appointment.rescheduled', {
    source: 'simplybook',
    booking_id: payload.booking_id,
    event_id: existingEvent.id,
    new_start: payload.start_datetime,
    new_end: payload.end_datetime,
  }).catch(err => console.warn('[simplybook-webhook] Outbound dispatch failed:', err?.message));
}

async function handleBookingCancelled(
  companyId: string,
  _integrationId: string,
  payload: SimplyBookWebhookPayload
): Promise<void> {
  const { data: existingEvent } = await supabaseAdmin
    .from('calendar_events')
    .select('id')
    .eq('company_id', companyId)
    .contains('metadata', { simplybook_booking_id: payload.booking_id })
    .maybeSingle();

  if (existingEvent) {
    await supabaseAdmin
      .from('calendar_events')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        metadata: {
          simplybook_booking_id: payload.booking_id,
          cancelled_at: new Date().toISOString(),
          cancelled_from: 'simplybook_webhook',
        },
      })
      .eq('id', existingEvent.id);
  }

  dispatchWebhookEvent(companyId, 'appointment.cancelled', {
    source: 'simplybook',
    booking_id: payload.booking_id,
    event_id: existingEvent?.id,
  }).catch(err => console.warn('[simplybook-webhook] Outbound dispatch failed:', err?.message));
}

// ============================================================================
// CONTACT RESOLUTION
// ============================================================================

/**
 * Find an existing contact or create one from SimplyBook client data
 */
async function resolveContact(
  companyId: string,
  integrationId: string,
  payload: SimplyBookWebhookPayload
): Promise<string | null> {
  if (!payload.client_id) return null;

  // Check existing mapping
  const { data: mapping } = await supabaseAdmin
    .from('simplybook_contact_mappings')
    .select('callengo_contact_id')
    .eq('integration_id', integrationId)
    .eq('sb_client_id', String(payload.client_id))
    .maybeSingle();

  if (mapping) return mapping.callengo_contact_id;

  // Try to find by email/phone
  let contactId: string | null = null;

  if (payload.client_email) {
    const { data } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('company_id', companyId)
      .ilike('email', payload.client_email)
      .limit(1)
      .maybeSingle();
    if (data) contactId = data.id;
  }

  if (!contactId && payload.client_phone) {
    const { data } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('company_id', companyId)
      .eq('phone_number', payload.client_phone)
      .limit(1)
      .maybeSingle();
    if (data) contactId = data.id;
  }

  if (!contactId) {
    // Create new contact
    const nameParts = (payload.client_name || '').split(/\s+/);
    const { data: newContact } = await supabaseAdmin
      .from('contacts')
      .insert({
        company_id: companyId,
        contact_name: payload.client_name || null,
        company_name: payload.client_name || 'SimplyBook Client',
        email: payload.client_email || null,
        phone_number: payload.client_phone || `sb-${payload.client_id}`,
        source: 'simplybook',
        status: 'Pending',
        custom_fields: {
          simplybook_client_id: payload.client_id,
          first_name: nameParts[0] || '',
          last_name: nameParts.slice(1).join(' ') || '',
        },
      })
      .select('id')
      .single();

    contactId = newContact?.id || null;
  }

  // Create mapping
  if (contactId) {
    await supabaseAdmin.from('simplybook_contact_mappings').insert({
      company_id: companyId,
      integration_id: integrationId,
      callengo_contact_id: contactId,
      sb_client_id: String(payload.client_id),
      last_synced_at: new Date().toISOString(),
      sync_direction: 'inbound',
    });
    // Mapping insert may fail on duplicate — that's fine
  }

  return contactId;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'SimplyBook.me webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
