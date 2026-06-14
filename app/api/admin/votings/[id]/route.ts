import { NextResponse } from 'next/server';
import {
  getVoting,
  updateVoting,
  replaceItems,
  deleteVoting,
  getVotingWithItems,
  closeOpenRoundsForVoting,
} from '@/lib/queries';
import { parseVotingInput, ValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  if (!getVoting(id)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  try {
    const input = parseVotingInput(body);
    updateVoting(id, input.title, input.masterImage);
    replaceItems(id, input.items);
    // Editing a voting starts a fresh block: any open round is invalidated so
    // existing votes never carry into the edited configuration.
    closeOpenRoundsForVoting(id);
    return NextResponse.json({ voting: getVotingWithItems(id) });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('update voting failed', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) return NextResponse.json({ error: 'bad id' }, { status: 400 });
  if (!getVoting(id)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  deleteVoting(id);
  return NextResponse.json({ ok: true });
}
