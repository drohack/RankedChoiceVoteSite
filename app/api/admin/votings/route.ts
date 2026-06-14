import { NextResponse } from 'next/server';
import { createVoting, replaceItems, getVotingWithItems } from '@/lib/queries';
import { parseVotingInput, ValidationError } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  try {
    const input = parseVotingInput(body);
    const id = createVoting(input.title, input.masterImage);
    replaceItems(id, input.items);
    return NextResponse.json({ voting: getVotingWithItems(id) }, { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('create voting failed', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
