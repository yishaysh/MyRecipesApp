import crypto from 'crypto';

export const GUEST_COOKIE_NAME = 'myrecipes_guest_id';
const GUEST_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  // Persistent deterministic fallback for serverless multi-instance environments (e.g. Vercel)
  return 'my-recipes-jwt-commercial-saas-2026-production-persistent-key-32chars';
}

export function signGuestCookieValue(guestId: string): string {
  const cleanId = guestId.trim();
  const sig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`guest:${cleanId}`)
    .digest('hex');
  return `${cleanId}.${sig}`;
}

export function verifyGuestCookieValue(rawValue: string | undefined): string | null {
  if (!rawValue || typeof rawValue !== 'string') return null;
  const trimmed = rawValue.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  if (dotIdx <= 0) return null;

  const guestId = trimmed.slice(0, dotIdx);
  const providedSig = trimmed.slice(dotIdx + 1);
  if (!guestId || !providedSig) return null;

  const expectedSig = crypto
    .createHmac('sha256', getJwtSecret())
    .update(`guest:${guestId}`)
    .digest('hex');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  return guestId;
}

export function parseCookiesHeader(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return result;

  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function extractVerifiedGuestIdFromRequest(headers: Record<string, string | string[] | undefined>): string | null {
  const rawCookieHeader = headers.cookie || headers.Cookie;
  const cookieHeader = Array.isArray(rawCookieHeader) ? rawCookieHeader[0] : rawCookieHeader;
  if (!cookieHeader) return null;

  const cookies = parseCookiesHeader(cookieHeader);
  return verifyGuestCookieValue(cookies[GUEST_COOKIE_NAME]);
}

export function buildGuestSetCookieHeader(guestId: string, headers?: Record<string, string | string[] | undefined>): string {
  const signedVal = encodeURIComponent(signGuestCookieValue(guestId));
  const protoHeader = headers?.['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const isHttps = proto === 'https' || Boolean(process.env.VERCEL);
  const secureFlag = isHttps ? '; Secure' : '';
  return `${GUEST_COOKIE_NAME}=${signedVal}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${GUEST_COOKIE_MAX_AGE_SECONDS}${secureFlag}`;
}
