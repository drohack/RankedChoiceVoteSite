import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOpenRound, getItems, insertBallot } from '@/lib/queries';
import { VOTED_COOKIE } from '@/lib/config';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const open = getOpenRound();
  if (!open) {
    return NextResponse.json({ error: 'No vote is running.' }, { status: 409 });
  }

  // Soft dedupe: a cookie recording the round this browser already voted in.
  const store = await cookies();
  if (store.get(VOTED_COOKIE)?.value === String(open.id)) {
    return NextResponse.json(
      { error: 'You have already voted in this round.' },
      { status: 409 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const rankingRaw = (body as { ranking?: unknown })?.ranking;
  if (!Array.isArray(rankingRaw) || rankingRaw.length === 0) {
    return NextResponse.json(
      { error: 'Rank at least one item.' },
      { status: 400 }
    );
  }

  // Only allow ids that belong to this voting, with no duplicates, preserving order.
  const validIds = new Set(getItems(open.voting_id).map((it) => it.id));
  const seen = new Set<number>();
  const ranking: number[] = [];
  for (const raw of rankingRaw) {
    const id = Number(raw);
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    ranking.push(id);
  }
  if (ranking.length === 0) {
    return NextResponse.json({ error: 'No valid choices.' }, { status: 400 });
  }

  insertBallot(open.id, ranking);
  store.set(VOTED_COOKIE, String(open.id), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return NextResponse.json({ ok: true });
}
