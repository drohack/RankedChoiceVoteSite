import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken } from './session';

const DAY = 1000 * 60 * 60 * 24;

describe('session tokens', () => {
  it('verifies a freshly signed token', async () => {
    const now = 1_000_000;
    const token = await createSessionToken(now);
    expect(await verifySessionToken(token, now)).toBe(true);
  });

  it('rejects an expired token (past the 7-day TTL)', async () => {
    const now = 1_000_000;
    const token = await createSessionToken(now);
    expect(await verifySessionToken(token, now + 8 * DAY)).toBe(false);
  });

  it('rejects a tampered signature', async () => {
    const now = 1_000_000;
    const token = await createSessionToken(now);
    const tampered = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(await verifySessionToken(tampered, now)).toBe(false);
  });

  it('rejects a tampered expiry (forged longer session)', async () => {
    const now = 1_000_000;
    const token = await createSessionToken(now);
    const sig = token.slice(token.indexOf('.') + 1);
    const forged = `${now + 999 * DAY}.${sig}`;
    expect(await verifySessionToken(forged, now)).toBe(false);
  });

  it('rejects missing / malformed tokens', async () => {
    const now = 1_000_000;
    expect(await verifySessionToken(undefined, now)).toBe(false);
    expect(await verifySessionToken('', now)).toBe(false);
    expect(await verifySessionToken('garbage', now)).toBe(false);
    expect(await verifySessionToken('.abc', now)).toBe(false);
  });

  it('rejects a token signed with a different secret', async () => {
    const now = 1_000_000;
    const token = await createSessionToken(now);
    const prev = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = 'a-totally-different-secret';
    try {
      expect(await verifySessionToken(token, now)).toBe(false);
    } finally {
      process.env.SESSION_SECRET = prev;
    }
  });
});
