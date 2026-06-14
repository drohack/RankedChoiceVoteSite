import { cookies } from 'next/headers';
import { ADMIN_PASSWORD } from './config';
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySessionToken,
  SESSION_MAX_AGE_SECONDS,
} from './session';

export function checkPassword(password: string): boolean {
  return (
    typeof password === 'string' &&
    password.length > 0 &&
    password === ADMIN_PASSWORD
  );
}

/** Set the signed admin session cookie. Call from a route handler. */
export async function setSessionCookie(): Promise<void> {
  const token = await createSessionToken(Date.now());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** True if the current request carries a valid admin session. */
export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token, Date.now());
}
