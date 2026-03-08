/**
 * n8n Webhook Forwarder
 *
 * Forwards webhook payloads to n8n when N8N_WEBHOOK_BASE_URL is configured.
 * This runs fire-and-forget (non-blocking) so it doesn't slow down the main webhook.
 *
 * Set these env vars to enable:
 *   N8N_WEBHOOK_BASE_URL=https://your-instance.app.n8n.cloud/webhook
 *
 * Optionally disable forwarding for specific webhooks:
 *   N8N_FORWARD_BLAND=true    (default: true if base URL is set)
 *   N8N_FORWARD_STRIPE=true   (default: true if base URL is set)
 */

const N8N_BASE_URL = process.env.N8N_WEBHOOK_BASE_URL;

type WebhookType = 'bland' | 'stripe' | 'slack-notify' | 'lead-scored';

const PATH_MAP: Record<WebhookType, string> = {
  bland: '/bland-call-complete',
  stripe: '/stripe-events',
  'slack-notify': '/slack-notify',
  'lead-scored': '/lead-scored',
};

function isForwardingEnabled(type: WebhookType): boolean {
  if (!N8N_BASE_URL) return false;

  const envKey = `N8N_FORWARD_${type.toUpperCase().replace('-', '_')}`;
  const envVal = process.env[envKey];

  // Default to true if base URL is set, unless explicitly disabled
  if (envVal === 'false' || envVal === '0') return false;
  return true;
}

/**
 * Forward a webhook payload to n8n (fire-and-forget).
 * Non-blocking — errors are logged but never thrown.
 */
export function forwardToN8n(
  type: WebhookType,
  payload: unknown,
  headers?: Record<string, string>
): void {
  if (!isForwardingEnabled(type)) return;

  const url = `${N8N_BASE_URL}${PATH_MAP[type]}`;

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Fire-and-forget — do not await
  fetch(url, {
    method: 'POST',
    headers: fetchHeaders,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000), // 10s timeout
  }).catch((err) => {
    console.warn(`[n8n-forwarder] Failed to forward ${type} webhook to n8n:`, err.message);
  });
}

/**
 * Forward Bland AI webhook data to n8n.
 * Call this right after signature verification in the Bland webhook handler.
 */
export function forwardBlandWebhookToN8n(
  body: Record<string, unknown>,
  rawSignature?: string | null
): void {
  const headers: Record<string, string> = {};
  if (rawSignature) {
    headers['x-bland-signature'] = rawSignature;
  }
  forwardToN8n('bland', body, headers);
}

/**
 * Forward Stripe webhook event to n8n.
 * Call this right after Stripe signature verification.
 */
export function forwardStripeWebhookToN8n(
  body: unknown,
  stripeSignature?: string | null
): void {
  const headers: Record<string, string> = {};
  if (stripeSignature) {
    headers['stripe-signature'] = stripeSignature;
  }
  forwardToN8n('stripe', body, headers);
}

/**
 * Send a notification event to the n8n Slack hub.
 */
export function notifyN8nSlack(
  companyId: string,
  eventType: string,
  data: Record<string, unknown>
): void {
  forwardToN8n('slack-notify', {
    company_id: companyId,
    event_type: eventType,
    data,
    timestamp: new Date().toISOString(),
  });
}
