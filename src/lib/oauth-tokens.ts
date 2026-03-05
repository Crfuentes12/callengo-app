import { encrypt, decrypt } from './crypto';

export function encryptToken(token: string | null): string | null {
  if (!token) return null;
  try {
    return encrypt(token);
  } catch {
    // If encryption key not set, store plaintext (dev mode)
    console.warn('OAUTH_ENCRYPTION_KEY not set, storing token in plaintext');
    return token;
  }
}

export function decryptToken(token: string | null): string | null {
  if (!token) return null;
  try {
    return decrypt(token);
  } catch {
    // If decryption fails, assume it's a legacy plaintext token
    return token;
  }
}
