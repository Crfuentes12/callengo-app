// lib/oauth-state.ts — Signed OAuth state to prevent cross-tenant hijack
import crypto from 'crypto';

const STATE_SECRET = process.env.OAUTH_STATE_SECRET || process.env.INTERNAL_API_SECRET;

/**
 * Create a signed OAuth state parameter.
 * HMAC-SHA256 prevents tampering with company_id or other fields.
 */
export function createSignedState(data: Record<string, unknown>): string {
  if (!STATE_SECRET) {
    throw new Error('OAUTH_STATE_SECRET or INTERNAL_API_SECRET must be configured');
  }
  const payload = JSON.stringify(data);
  const signature = crypto
    .createHmac('sha256', STATE_SECRET)
    .update(payload, 'utf8')
    .digest('hex');
  const signed = JSON.stringify({ payload, signature });
  return Buffer.from(signed).toString('base64url');
}

/**
 * Verify and decode a signed OAuth state parameter.
 * Returns null if signature is invalid or state is malformed.
 */
export function verifySignedState(state: string): Record<string, unknown> | null {
  if (!STATE_SECRET) {
    console.error('[oauth-state] No STATE_SECRET configured');
    return null;
  }
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf-8');
    const { payload, signature } = JSON.parse(decoded);
    if (!payload || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', STATE_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    if (!isValid) return null;
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
