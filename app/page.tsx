import { cookies } from 'next/headers';
import { getOpenRound, getVotingWithItems } from '@/lib/queries';
import { VOTED_COOKIE } from '@/lib/config';
import VotingForm from './VotingForm';

// This page reflects live DB state (the open round), so never cache it.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const round = getOpenRound();
  const voting = round ? getVotingWithItems(round.voting_id) : undefined;

  if (!round || !voting) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl font-semibold text-slate-200">
            No vote is running right now
          </h1>
          <p className="mt-3 text-slate-400">
            Check back soon — voting will open here when it&apos;s time.
          </p>
        </div>
      </main>
    );
  }

  const store = await cookies();
  const alreadyVoted = store.get(VOTED_COOKIE)?.value === String(round.id);

  if (alreadyVoted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl">🗳️</div>
        <h1 className="mt-4 text-2xl font-semibold">You&apos;ve already voted</h1>
        <p className="mt-2 max-w-sm text-slate-400">
          Thanks! Your ranking for “{voting.title}” has been recorded.
        </p>
      </main>
    );
  }

  return (
    <VotingForm
      title={voting.title}
      masterImage={voting.master_image}
      items={voting.items}
    />
  );
}
