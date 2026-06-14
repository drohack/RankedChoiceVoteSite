import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/** Paths under the guarded prefixes that remain public. */
const PUBLIC_EXCEPTIONS = ['/admin/login', '/api/admin/login'];

function isGuarded(pathname: string): boolean {
  if (PUBLIC_EXCEPTIONS.includes(pathname)) return false;
  return (
    pathname === '/results' ||
    pathname.startsWith('/results/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin')
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isGuarded(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySessionToken(token, Date.now());
  if (ok) return NextResponse.next();

  // API routes get a 401; page routes redirect to the login form.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const loginUrl = new URL('/admin/login', req.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/results/:path*', '/results', '/api/admin/:path*'],
};
