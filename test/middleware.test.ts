import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { SESSION_COOKIE, createSessionToken } from '@/lib/session';

function request(path: string, token?: string) {
  const req = new NextRequest(new URL(`http://localhost${path}`));
  if (token) req.cookies.set(SESSION_COOKIE, token);
  return req;
}

describe('auth middleware', () => {
  it('redirects an unauthenticated page request to the login form', async () => {
    const res = await middleware(request('/admin'));
    expect(res.status).toBe(307);
    const location = res.headers.get('location') ?? '';
    expect(location).toContain('/admin/login');
    expect(location).toContain('next=%2Fadmin');
  });

  it('guards /results too', async () => {
    const res = await middleware(request('/results'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });

  it('returns 401 (not a redirect) for unauthenticated admin API calls', async () => {
    const res = await middleware(request('/api/admin/votings'));
    expect(res.status).toBe(401);
  });

  it('lets a request with a valid session cookie through', async () => {
    const token = await createSessionToken(Date.now());
    const res = await middleware(request('/admin', token));
    expect(res.headers.get('location')).toBeNull(); // not redirected
    expect(res.status).not.toBe(401);
  });

  it('does not guard the login page or the public vote API', async () => {
    expect((await middleware(request('/admin/login'))).headers.get('location')).toBeNull();
    expect((await middleware(request('/api/admin/login'))).status).not.toBe(401);
  });

  it('rejects a request carrying an expired/invalid cookie', async () => {
    const res = await middleware(request('/admin', 'not-a-valid-token'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/admin/login');
  });
});
