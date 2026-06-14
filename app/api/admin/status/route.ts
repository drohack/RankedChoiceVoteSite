import { NextResponse } from 'next/server';
import { getOpenRound, countBallots } from '@/lib/queries';

export const runtime = 'nodejs';

// Always reflect live DB state.
export const dynamic = 'force-dynamic';

export async function GET() {
  const open = getOpenRound();
  if (!open) {
    return NextResponse.json({ open: null });
  }
  return NextResponse.json({
    open: {
      roundId: open.id,
      votingId: open.voting_id,
      ballotCount: countBallots(open.id),
    },
  });
}
