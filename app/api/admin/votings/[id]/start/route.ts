import { NextResponse } from 'next/server';
import { getVoting, getItems, startRound } from '@/lib/queries';

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
  if (!getVoting(id)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (getItems(id).length < 2) {
    return NextResponse.json(
      { error: 'Add at least two items before starting.' },
      { status: 400 }
    );
  }

  // startRound closes any other open round first — only one vote runs at a time.
  const roundId = startRound(id);
  return NextResponse.json({ roundId });
}
