import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

// Mock ONLY the cookie jar (next/headers). The database stays real (in-memory).
const { cookieJar } = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name) } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

import { __setTestDbToMemory, __closeDb } from '@/lib/db';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';
import { VOTED_COOKIE } from '@/lib/config';
import { createVoting, replaceItems, getItems, startRound } from '@/lib/queries';
import { POST as login } from '@/app/api/admin/login/route';
import { POST as logout } from '@/app/api/admin/logout/route';
import { POST as vote } from '@/app/api/vote/route';

beforeEach(() => {
  cookieJar.clear();
  __setTestDbToMemory();
});
afterAll(() => {
  __closeDb();
});

function jsonReq(body: unknown) {
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('admin login / logout', () => {
  it('rejects the wrong password and sets no cookie', async () => {
    const res = await login(jsonReq({ password: 'nope' }));
    expect(res.status).toBe(401);
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
  });

  it('accepts the correct password and sets a valid session cookie', async () => {
    const res = await login(jsonReq({ password: 'test-pass' }));
    expect(res.status).toBe(200);
    const token = cookieJar.get(SESSION_COOKIE);
    expect(token).toBeTruthy();
    expect(await verifySessionToken(token, Date.now())).toBe(true);
  });

  it('logout clears the session cookie', async () => {
    await login(jsonReq({ password: 'test-pass' }));
    await logout();
    expect(cookieJar.has(SESSION_COOKIE)).toBe(false);
  });
});

describe('vote route', () => {
  function openVotingRound() {
    const v = createVoting('V', null);
    replaceItems(v, [{ name: 'A', image: null }, { name: 'B', image: null }]);
    const ids = getItems(v).map((i) => i.id);
    startRound(v);
    return ids;
  }

  it('409 when no vote is running', async () => {
    const res = await vote(jsonReq({ ranking: [1] }));
    expect(res.status).toBe(409);
  });

  it('records a ballot, sets the dedupe cookie, then blocks re-voting', async () => {
    const ids = openVotingRound();
    const res1 = await vote(jsonReq({ ranking: [ids[0], ids[1]] }));
    expect(res1.status).toBe(200);
    expect(cookieJar.has(VOTED_COOKIE)).toBe(true);

    const res2 = await vote(jsonReq({ ranking: [ids[0]] }));
    expect(res2.status).toBe(409); // same cookie → already voted
  });

  it('400 on an empty ranking', async () => {
    openVotingRound();
    const res = await vote(jsonReq({ ranking: [] }));
    expect(res.status).toBe(400);
  });

  it('ignores ids that do not belong to the voting', async () => {
    const ids = openVotingRound();
    const res = await vote(jsonReq({ ranking: [99999, ids[0]] }));
    expect(res.status).toBe(200); // bogus id filtered, valid id remains
  });
});
