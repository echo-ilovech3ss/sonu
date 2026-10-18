import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { isIP } from 'node:net';
import type { Context } from 'hono';
import { getConnInfo } from 'hono/bun';

/** Crockford base32: no I, L, O or U. */
const TRACKING_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TRACKING_PATTERN = /^SNU-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const MAX_USER_AGENT_LENGTH = 512;
const MAX_IP_LENGTH = 45;
const PLACEHOLDER_ADMIN_KEYS: Record<string, true> = {
  'sonu-dev': true,
  'change-me': true,
};

export function generateTrackingCode(): string {
  const block = () => {
    let value = '';
    for (let index = 0; index < 4; index += 1) {
      value += TRACKING_ALPHABET[randomInt(0, TRACKING_ALPHABET.length)];
    }
    return value;
  };
  return `SNU-${block()}-${block()}`;
}

export function normalizeTrackingCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isValidTrackingCode(code: string): boolean {
  return TRACKING_PATTERN.test(code);
}

export function hashTrackingCode(code: string): string {
  return createHash('sha256').update(normalizeTrackingCode(code), 'utf8').digest('hex');
}

export function trackingLast4(code: string): string {
  return normalizeTrackingCode(code).slice(-4);
}

function trackingCodeKey(): Buffer {
  const secret =
    process.env.SONU_CODE_KEY ||
    process.env.SONU_ADMIN_KEY ||
    'sonu-dev';
  return createHash('sha256').update(secret, 'utf8').digest();
}

/**
 * Admin-only recovery copy of the tracking code. Lookup still uses the
 * one-way hash; this ciphertext exists so the owner can see and advance an
 * order from the studio without storing the bearer code in plaintext.
 */
export function encryptTrackingCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', trackingCodeKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(normalizeTrackingCode(code), 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptTrackingCode(payload: string | null): string | null {
  if (!payload) return null;

  try {
    const [iv, tag, encrypted] = payload
      .split('.')
      .map((part) => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', trackingCodeKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

function validIp(value: string | undefined | null): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > MAX_IP_LENGTH) return null;
  return isIP(candidate) ? candidate : null;
}

export function getClientIp(c: Context): string | null {
  // Behind Cloudflare, CF-Connecting-IP is the only forwarding header the
  // edge overwrites. Fall back to the usual proxy headers, but never store an
  // unvalidated, unbounded string.
  const cloudflareIp = validIp(c.req.header('cf-connecting-ip'));
  if (cloudflareIp) return cloudflareIp;

  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) {
    for (const part of forwarded.split(',')) {
      const forwardedIp = validIp(part);
      if (forwardedIp) return forwardedIp;
    }
  }

  const realIp = validIp(c.req.header('x-real-ip'));
  if (realIp) return realIp;

  try {
    return validIp(getConnInfo(c).remote.address);
  } catch {
    return null;
  }
}

export function getUserAgent(c: Context): string | null {
  const userAgent = c.req.header('user-agent');
  return userAgent ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null;
}

export function getAdminKey(): string {
  const configured = process.env.SONU_ADMIN_KEY?.trim();
  if (configured && !PLACEHOLDER_ADMIN_KEYS[configured]) return configured;

  // Fail closed in production. The CLI uses the store directly, so local
  // operations do not depend on the HTTP admin endpoint.
  return process.env.NODE_ENV === 'production' ? '' : 'sonu-dev';
}

export function assertAdminKeyConfigured(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const key = process.env.SONU_ADMIN_KEY?.trim() ?? '';
  if (key.length < 32 || PLACEHOLDER_ADMIN_KEYS[key]) {
    throw new Error(
      'SONU_ADMIN_KEY must be set to at least 32 random characters before starting in production.',
    );
  }
}

export function safeCompare(left: string, right: string): boolean {
  // Hash first so comparison is fixed-length even when an attacker controls
  // the submitted key length.
  const leftDigest = createHash('sha256').update(left, 'utf8').digest();
  const rightDigest = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(leftDigest, rightDigest);
}
