import crypto from 'crypto';

const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error('OAUTH_STATE_SECRET environment variable is required');
  }
  return secret;
}

interface OAuthStatePayload {
  user_id: string;
  company_id: string;
  provider: string;
  timestamp: number;
  return_to?: string;
  [key: string]: unknown;
}

export function createSignedState(payload: OAuthStatePayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getStateSecret())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifyAndDecodeState(state: string): OAuthStatePayload | null {
  try {
    // Handle legacy unsigned states (just base64url JSON)
    if (!state.includes('.')) {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
      // Legacy - accept but log warning
      console.warn('Legacy unsigned OAuth state detected');
      return decoded;
    }

    const [data, signature] = state.split('.');
    const expectedSignature = crypto
      .createHmac('sha256', getStateSecret())
      .update(data)
      .digest('base64url');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      console.error('Invalid OAuth state signature');
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as OAuthStatePayload;

    // Check expiry
    if (Date.now() - payload.timestamp > STATE_EXPIRY_MS) {
      console.error('OAuth state expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('Failed to verify OAuth state:', error);
    return null;
  }
}

const ALLOWED_RETURN_PATHS = [
  '/integrations',
  '/settings',
  '/dashboard',
  '/contacts',
  '/calendar',
  '/agents',
  '/campaigns',
];

export function validateReturnTo(returnTo: string | undefined | null): string {
  const defaultReturn = '/integrations';
  if (!returnTo) return defaultReturn;

  // Must be a relative path (no protocol/host)
  try {
    // If it parses as a full URL with a different origin, reject it
    if (returnTo.startsWith('http://') || returnTo.startsWith('https://') || returnTo.startsWith('//')) {
      console.warn('Rejected absolute return_to URL:', returnTo);
      return defaultReturn;
    }

    // Must start with /
    if (!returnTo.startsWith('/')) {
      return defaultReturn;
    }

    // Check against allowed path prefixes
    const isAllowed = ALLOWED_RETURN_PATHS.some(path => returnTo.startsWith(path));
    if (!isAllowed) {
      console.warn('Rejected return_to path not in whitelist:', returnTo);
      return defaultReturn;
    }

    return returnTo;
  } catch {
    return defaultReturn;
  }
}
