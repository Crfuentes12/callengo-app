// lib/encryption.ts — AES-256-GCM encryption for OAuth tokens and sensitive data
// Uses a single master key from environment variable TOKEN_ENCRYPTION_KEY.
// Key must be 64 hex characters (32 bytes).
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;
const ENCODING = 'base64' as const;
// Prefix to detect already-encrypted values
const ENCRYPTED_PREFIX = 'enc:';

function getKey(): Buffer {
  const hexKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hexKey) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  if (hexKey.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a prefixed base64 string: "enc:<iv>:<authTag>:<ciphertext>"
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  // Already encrypted — return as-is
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString(ENCODING)}:${authTag.toString(ENCODING)}:${encrypted.toString(ENCODING)}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * If the value is not encrypted (no prefix), returns it as-is for backward compatibility.
 */
export function decryptToken(encrypted: string): string {
  if (!encrypted) return encrypted;
  // Not encrypted — return plaintext (backward compatibility during migration)
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) return encrypted;

  const key = getKey();
  const payload = encrypted.slice(ENCRYPTED_PREFIX.length);
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':');

  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivB64, ENCODING);
  const authTag = Buffer.from(authTagB64, ENCODING);
  const ciphertext = Buffer.from(ciphertextB64, ENCODING);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypt token fields in an object. Returns a new object with encrypted values.
 * Only encrypts specified fields, passes others through.
 */
export function encryptTokenFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): T {
  const result = { ...data };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value) {
      (result as Record<string, unknown>)[field as string] = encryptToken(value);
    }
  }
  return result;
}

/**
 * Decrypt token fields in an object. Returns a new object with decrypted values.
 * Only decrypts specified fields, passes others through.
 */
export function decryptTokenFields<T extends Record<string, unknown>>(
  data: T,
  fields: (keyof T)[]
): T {
  const result = { ...data };
  for (const field of fields) {
    const value = result[field];
    if (typeof value === 'string' && value) {
      (result as Record<string, unknown>)[field as string] = decryptToken(value);
    }
  }
  return result;
}
