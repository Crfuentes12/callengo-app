// app/api/integrations/calendly/webhook/route.ts
// Receives real-time webhook events from Calendly

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/service';
import { processCalendlyWebhook } from '@/lib/calendar/calendly';
import type { CalendlyWebhookPayload } from '@/types/calendar';
import crypto from 'crypto';

/**
 * Verify Calendly webhook signature (if signing key is configured)
 */
function verifyWebhookSignature(
  body: string,
  signature: string | null,
  signingKey: string | undefined
): boolean {
  if (!signingKey || !signature) {
    // If no signing key configured, skip verification
    return true;
  }

  try {
    // Calendly uses HMAC-SHA256 for webhook signatures
    const [t, v1] = signature.split(',').reduce(
      (acc, part) => {
        const [key, value] = part.split('=');
        if (key === 't') acc[0] = value;
        if (key === 'v1') acc[1] = value;
        return acc;
      },
      ['', '']
    );

    const data = `${t}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', signingKey)
      .update(data)
      .digest('hex');

    return expectedSignature === v1;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('calendly-webhook-signature');
    const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature, signingKey)) {
      console.error('Invalid Calendly webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const payload: CalendlyWebhookPayload = JSON.parse(rawBody);

    console.log('Calendly webhook received:', payload.event);

    // Find the integration by the creator's user URI
    // The webhook was created by a specific user, so we can match it
    const createdBy = payload.created_by;

    const { data: integration } = await supabaseAdmin
      .from('calendar_integrations')
      .select('id, company_id')
      .eq('provider', 'calendly')
      .eq('provider_user_id', createdBy)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      // Try matching by organization from event memberships
      const memberEmails = payload.payload.scheduled_event?.event_memberships?.map(
        (m) => m.user_email
      ) || [];

      if (memberEmails.length > 0) {
        const { data: integrationByEmail } = await supabaseAdmin
          .from('calendar_integrations')
          .select('id, company_id')
          .eq('provider', 'calendly')
          .eq('is_active', true)
          .in('provider_email', memberEmails)
          .limit(1)
          .maybeSingle();

        if (integrationByEmail) {
          const result = await processCalendlyWebhook(
            payload,
            integrationByEmail.company_id,
            integrationByEmail.id
          );

          return NextResponse.json({
            status: 'processed',
            action: result.action,
            event_id: result.eventId,
          });
        }
      }

      console.warn('No matching Calendly integration found for webhook');
      return NextResponse.json(
        { status: 'skipped', reason: 'No matching integration' },
        { status: 200 } // Return 200 to prevent Calendly from retrying
      );
    }

    const result = await processCalendlyWebhook(
      payload,
      integration.company_id,
      integration.id
    );

    return NextResponse.json({
      status: 'processed',
      action: result.action,
      event_id: result.eventId,
    });
  } catch (error) {
    console.error('Error processing Calendly webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Calendly webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
