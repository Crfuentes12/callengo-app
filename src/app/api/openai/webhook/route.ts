// app/api/openai/webhook/route.ts
// Receives and processes OpenAI webhook events.
// Signature verified with HMAC-SHA256 using OPENAI_WEBHOOK_SECRET.
// Register this endpoint in OpenAI Platform → Settings → Webhooks.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { trackOpenAIUsage, type FeatureKey } from '@/lib/openai/tracker';

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    // Use timingSafeEqual to prevent timing attacks
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.OPENAI_WEBHOOK_SECRET;

  // If no secret configured, accept but log a warning
  if (!secret) {
    console.warn('[openai/webhook] OPENAI_WEBHOOK_SECRET not set — webhook not verified');
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
  }

  // Verify signature if secret is configured
  if (secret) {
    const sig =
      request.headers.get('openai-signature') ||
      request.headers.get('x-openai-signature') ||
      '';

    if (!sig) {
      return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }

    if (!verifySignature(rawBody, sig, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // Parse event payload defensively
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const eventType = (event?.type as string) || 'unknown';
  console.log('[openai/webhook] Received event:', eventType);

  // ─── Process known event types ──────────────────────────────────────────────

  if (eventType === 'response.completed' || eventType === 'response.done') {
    // Responses API completion event
    const data = (event?.data as Record<string, unknown>) ?? {};
    const usage = (data?.usage as Record<string, unknown>) ?? {};

    const inputTokens = (usage?.input_tokens as number) ?? 0;
    const outputTokens = (usage?.output_tokens as number) ?? 0;
    const model = (data?.model as string) ?? 'gpt-4o-mini';
    const requestId = (data?.id as string) ?? undefined;

    if (inputTokens > 0 || outputTokens > 0) {
      // Webhooks don't carry feature context, so we log as call_analysis (generic)
      // In practice, per-feature tracking is handled inline in each API route
      trackOpenAIUsage({
        featureKey: 'call_analysis' as FeatureKey,
        model,
        inputTokens,
        outputTokens,
        openaiRequestId: requestId,
        companyId: null,
        userId: null,
        metadata: { source: 'openai_webhook', event_type: eventType },
      });
    }

  } else if (
    eventType === 'usage.daily_cost_updated' ||
    eventType === 'usage.updated'
  ) {
    // Usage summary events — log for observability but no DB insert needed
    const data = (event?.data as Record<string, unknown>) ?? {};
    console.log('[openai/webhook] Usage event data:', JSON.stringify(data));

  } else {
    // All other event types — acknowledge but don't process
    console.log('[openai/webhook] Unhandled event type:', eventType, '— acknowledged');
  }

  return NextResponse.json({ received: true });
}
