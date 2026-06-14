/**
 * Admin session cookie helpers. Uses the Web Crypto API (available in both the
 * Edge middleware runtime and the Node.js route-handler runtime) so the same
 * signing/verification logic works everywhere. No Node-only imports here.
 */

export const SESSION_COOKIE = 'rcv_admin';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return (
    process.env.SESSION_SECRET ?? 'dev-insecure-session-secret-change-me'
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmac(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  );
  return toHex(sig);
}

/** Constant-time-ish string compare. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Create a signed session token valid for SESSION_TTL_MS. */
export async function createSessionToken(now: number): Promise<string> {
  const exp = now + SESSION_TTL_MS;
  const payload = `admin.${exp}`;
  const sig = await hmac(payload);
  return `${exp}.${sig}`;
}

/** Verify a session token's signature and expiry. */
export async function verifySessionToken(
  token: string | undefined,
  now: number
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = await hmac(`admin.${expStr}`);
  return safeEqual(sig, expected);
}

export const SESSION_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
