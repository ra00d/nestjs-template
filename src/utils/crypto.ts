import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const TOKEN_BYTES = 32;
const NONCE_BYTES = 12;
const KEY_BYTES = 32;

/** URL-safe opaque token (`32` random bytes, base64url, no padding). */
export function randomToken(bytes: number = TOKEN_BYTES): string {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new RangeError('bytes must be a positive integer');
  }
  return randomBytes(bytes).toString('base64url');
}

/**
 * SHA-256 hex digest. Store this instead of a raw token (session, API key,
 * invite): a database leak then reveals no usable secret. Compare digests,
 * never the token itself.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Constant-time string comparison; safe for secrets of any length. */
export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * AES-256-GCM encryption for secrets at rest (OAuth tokens, PII blobs).
 * Returns `nonce.ciphertext.tag`, each base64url. The key must be 32
 * random bytes — keep it in the secret manager, never in the database.
 */
export function encryptString(plaintext: string, key: Buffer): string {
  assertKey(key);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [nonce, ciphertext, tag]
    .map((part) => part.toString('base64url'))
    .join('.');
}

/** Inverse of `encryptString`; throws when the key is wrong or data tampered. */
export function decryptString(payload: string, key: Buffer): string {
  assertKey(key);
  const [nonce, ciphertext, tag] = payload
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'));
  if (!nonce || !ciphertext || !tag) {
    throw new Error('malformed encrypted payload');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return (
    decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
  );
}

function assertKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) {
    throw new RangeError(`key must be a ${KEY_BYTES}-byte Buffer`);
  }
}
