// lib/webhooks.ts
// Outbound webhook dispatcher service
// Sends real-time events to user-configured webhook endpoints

import crypto from 'crypto';
import { supabaseAdminRaw as supabaseAdmin } from '@/lib/supabase/service';

// ============================================================================
// TYPES
// ============================================================================

export type WebhookEventType =
  | 'call.completed'
  | 'call.failed'
  | 'call.no_answer'
  | 'call.voicemail'
  | 'appointment.scheduled'
  | 'appointment.confirmed'
  | 'appointment.rescheduled'
  | 'appointment.cancelled'
  | 'appointment.no_show'
  | 'contact.updated'
  | 'campaign.completed'
  | 'campaign.started';

export const ALL_WEBHOOK_EVENTS: { type: WebhookEventType; label: string; description: string }[] = [
  { type: 'call.completed', label: 'Call Completed', description: 'Fired when an AI call finishes successfully' },
  { type: 'call.failed', label: 'Call Failed', description: 'Fired when a call fails or errors out' },
  { type: 'call.no_answer', label: 'Call No Answer', description: 'Fired when a contact does not answer' },
  { type: 'call.voicemail', label: 'Call Voicemail', description: 'Fired when voicemail is detected' },
  { type: 'appointment.scheduled', label: 'Appointment Scheduled', description: 'Fired when a new appointment is created' },
  { type: 'appointment.confirmed', label: 'Appointment Confirmed', description: 'Fired when an appointment is confirmed' },
  { type: 'appointment.rescheduled', label: 'Appointment Rescheduled', description: 'Fired when an appointment is rescheduled' },
  { type: 'appointment.cancelled', label: 'Appointment Cancelled', description: 'Fired when an appointment is cancelled' },
  { type: 'appointment.no_show', label: 'Appointment No Show', description: 'Fired when a contact is marked as no-show' },
  { type: 'contact.updated', label: 'Contact Updated', description: 'Fired when contact data is modified after a call' },
  { type: 'campaign.completed', label: 'Campaign Completed', description: 'Fired when all contacts in a campaign have been called' },
  { type: 'campaign.started', label: 'Campaign Started', description: 'Fired when a campaign begins making calls' },
];

export interface WebhookEndpoint {
  id: string;
  company_id: string;
  url: string;
  description: string | null;
  secret: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_failure_reason: string | null;
  consecutive_failures: number;
  auto_disabled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  endpoint_id: string;
  company_id: string;
  event_type: string;
  event_id: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'success' | 'failed';
  http_status: number | null;
  response_body: string | null;
  error_message: string | null;
  attempt_number: number;
  delivered_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

// ============================================================================
// SIGNING
// ============================================================================

/**
 * Generate HMAC-SHA256 signature for webhook payload verification.
 * Recipients can verify by computing the same HMAC with their secret.
 */
function signPayload(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
}

/**
 * Generate a random webhook signing secret.
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Verify an inbound webhook signature and check timestamp freshness.
 * Can be used by any endpoint receiving signed Callengo webhooks.
 */
export function verifyInboundWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): { valid: boolean; error?: string } {
  // Verify signature
  const expectedSignature = signPayload(payload, secret);
  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );

  if (!isValid) {
    return { valid: false, error: 'Invalid webhook signature' };
  }

  // Check timestamp freshness — reject if older than 5 minutes
  const MAX_TIMESTAMP_AGE_SECONDS = 300; // 5 minutes
  const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (isNaN(timestampAge) || timestampAge > MAX_TIMESTAMP_AGE_SECONDS) {
    return { valid: false, error: 'Webhook timestamp too old' };
  }

  return { valid: true };
}

// ============================================================================
// DISPATCHING
// ============================================================================

const MAX_CONSECUTIVE_FAILURES = 10;
const DELIVERY_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Dispatch a webhook event to all active endpoints for a company that subscribe to this event type.
 * This is fire-and-forget — errors are logged but don't throw.
 */
export async function dispatchWebhookEvent(
  companyId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Fetch all active endpoints for this company that subscribe to this event
    const { data: endpoints, error } = await supabaseAdmin
      .from('webhook_endpoints')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('auto_disabled_at', null)
      .contains('events', [eventType]);

    if (error || !endpoints || endpoints.length === 0) return;

    const eventId = `evt_${crypto.randomBytes(12).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const payload = {
      id: eventId,
      type: eventType,
      created_at: timestamp,
      data,
    };

    // Deliver to all matching endpoints concurrently
    await Promise.allSettled(
      endpoints.map((endpoint: WebhookEndpoint) =>
        deliverToEndpoint(endpoint, eventType, eventId, payload)
      )
    );
  } catch (err) {
    console.error('[Webhooks] Failed to dispatch event:', err);
  }
}

/**
 * Deliver a webhook payload to a single endpoint.
 * Records the delivery attempt and updates endpoint health.
 */
async function deliverToEndpoint(
  endpoint: WebhookEndpoint,
  eventType: string,
  eventId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const payloadStr = JSON.stringify(payload);
  const signature = signPayload(payloadStr, endpoint.secret);
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const startTime = Date.now();
  let httpStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  let status: 'success' | 'failed' = 'failed';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callengo-Signature': signature,
        'X-Callengo-Timestamp': timestamp,
        'X-Callengo-Event': eventType,
        'X-Callengo-Delivery': eventId,
        'User-Agent': 'Callengo-Webhooks/1.0',
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    httpStatus = response.status;
    try {
      const text = await response.text();
      responseBody = text.slice(0, 1024); // Keep first 1KB
    } catch { /* ignore */ }

    if (httpStatus >= 200 && httpStatus < 300) {
      status = 'success';
    } else {
      errorMessage = `HTTP ${httpStatus}`;
    }
  } catch (err: unknown) {
    if (err instanceof Error) {
      errorMessage = err.name === 'AbortError' ? 'Request timed out' : err.message;
    } else {
      errorMessage = 'Unknown error';
    }
  }

  const durationMs = Date.now() - startTime;

  // Record delivery
  await supabaseAdmin
    .from('webhook_deliveries')
    .insert({
      endpoint_id: endpoint.id,
      company_id: endpoint.company_id,
      event_type: eventType,
      event_id: eventId,
      payload,
      status,
      http_status: httpStatus,
      response_body: responseBody,
      error_message: errorMessage,
      attempt_number: 1,
      delivered_at: new Date().toISOString(),
      duration_ms: durationMs,
    });

  // Update endpoint health
  if (status === 'success') {
    await supabaseAdmin
      .from('webhook_endpoints')
      .update({
        last_triggered_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        consecutive_failures: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', endpoint.id);
  } else {
    const newFailures = endpoint.consecutive_failures + 1;
    const updateData: Record<string, unknown> = {
      last_triggered_at: new Date().toISOString(),
      last_failure_at: new Date().toISOString(),
      last_failure_reason: errorMessage,
      consecutive_failures: newFailures,
      updated_at: new Date().toISOString(),
    };

    // Auto-disable after too many consecutive failures
    if (newFailures >= MAX_CONSECUTIVE_FAILURES) {
      updateData.auto_disabled_at = new Date().toISOString();
      updateData.is_active = false;
    }

    await supabaseAdmin
      .from('webhook_endpoints')
      .update(updateData)
      .eq('id', endpoint.id);
  }
}

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

/**
 * List all webhook endpoints for a company.
 */
export async function listWebhookEndpoints(companyId: string): Promise<WebhookEndpoint[]> {
  const { data, error } = await supabaseAdmin
    .from('webhook_endpoints')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list webhook endpoints: ${error.message}`);
  return (data || []) as WebhookEndpoint[];
}

/**
 * Create a new webhook endpoint.
 */
export async function createWebhookEndpoint(
  companyId: string,
  url: string,
  events: string[],
  description?: string
): Promise<WebhookEndpoint> {
  const secret = generateWebhookSecret();

  const { data, error } = await supabaseAdmin
    .from('webhook_endpoints')
    .insert({
      company_id: companyId,
      url,
      description: description || null,
      secret,
      events,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create webhook endpoint: ${error.message}`);
  return data as WebhookEndpoint;
}

/**
 * Update a webhook endpoint.
 */
export async function updateWebhookEndpoint(
  endpointId: string,
  companyId: string,
  updates: {
    url?: string;
    events?: string[];
    description?: string;
    is_active?: boolean;
  }
): Promise<WebhookEndpoint> {
  const { data, error } = await supabaseAdmin
    .from('webhook_endpoints')
    .update({
      ...updates,
      // Re-enable if it was auto-disabled and user is manually activating
      ...(updates.is_active ? { auto_disabled_at: null, consecutive_failures: 0 } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', endpointId)
    .eq('company_id', companyId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update webhook endpoint: ${error.message}`);
  return data as WebhookEndpoint;
}

/**
 * Delete a webhook endpoint.
 */
export async function deleteWebhookEndpoint(
  endpointId: string,
  companyId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('webhook_endpoints')
    .delete()
    .eq('id', endpointId)
    .eq('company_id', companyId);

  if (error) throw new Error(`Failed to delete webhook endpoint: ${error.message}`);
}

/**
 * Regenerate the signing secret for an endpoint.
 */
export async function regenerateWebhookSecret(
  endpointId: string,
  companyId: string
): Promise<string> {
  const newSecret = generateWebhookSecret();

  const { error } = await supabaseAdmin
    .from('webhook_endpoints')
    .update({
      secret: newSecret,
      updated_at: new Date().toISOString(),
    })
    .eq('id', endpointId)
    .eq('company_id', companyId);

  if (error) throw new Error(`Failed to regenerate webhook secret: ${error.message}`);
  return newSecret;
}

/**
 * List recent deliveries for a company or specific endpoint.
 */
export async function listWebhookDeliveries(
  companyId: string,
  options?: {
    endpointId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<WebhookDelivery[]> {
  let query = supabaseAdmin
    .from('webhook_deliveries')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (options?.endpointId) {
    query = query.eq('endpoint_id', options.endpointId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list webhook deliveries: ${error.message}`);
  return (data || []) as WebhookDelivery[];
}

/**
 * Send a test event to a specific endpoint.
 */
export async function sendTestWebhook(
  endpoint: WebhookEndpoint
): Promise<{ success: boolean; httpStatus?: number; error?: string; durationMs: number }> {
  const testPayload = {
    id: `evt_test_${crypto.randomBytes(8).toString('hex')}`,
    type: 'test',
    created_at: new Date().toISOString(),
    data: {
      message: 'This is a test webhook from Callengo',
      endpoint_id: endpoint.id,
    },
  };

  const payloadStr = JSON.stringify(testPayload);
  const signature = signPayload(payloadStr, endpoint.secret);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callengo-Signature': signature,
        'X-Callengo-Timestamp': timestamp,
        'X-Callengo-Event': 'test',
        'X-Callengo-Delivery': testPayload.id,
        'User-Agent': 'Callengo-Webhooks/1.0',
      },
      body: payloadStr,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const durationMs = Date.now() - startTime;

    if (response.status >= 200 && response.status < 300) {
      return { success: true, httpStatus: response.status, durationMs };
    }

    return { success: false, httpStatus: response.status, error: `HTTP ${response.status}`, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error
      ? (err.name === 'AbortError' ? 'Request timed out (10s)' : err.message)
      : 'Unknown error';
    return { success: false, error: message, durationMs };
  }
}
