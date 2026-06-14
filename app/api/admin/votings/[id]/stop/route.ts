import { NextResponse } from 'next/server';
import { getOpenRound, stopRound } from '@/lib/queries';

export const runtime = 'nodejs';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 });
  }

  const open = getOpenRound();
  if (open && open.voting_id === id) {
    stopRound(open.id);
  }
  return NextResponse.json({ ok: true });
}
