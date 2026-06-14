import { NextResponse } from 'next/server';
import { checkPassword, setSessionCookie } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let password = '';
  try {
    const body = await req.json();
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'invalid password' }, { status: 401 });
  }

  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
