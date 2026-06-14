import Link from 'next/link';
import {
  listVotings,
  getItems,
  getOpenRound,
  countBallots,
} from '@/lib/queries';
import { VOTE_URL } from '@/lib/config';
import LogoutButton from './LogoutButton';
import DeleteVotingButton from './DeleteVotingButton';
import RoundButton from './RoundButton';
import LivePanel from './LivePanel';

export const dynamic = 'force-dynamic';

export default function AdminHome() {
  const votings = listVotings();
  const openRound = getOpenRound();
  const liveVotingId = openRound?.voting_id ?? null;
  const liveVoting = liveVotingId
    ? votings.find((v) => v.id === liveVotingId)
    : undefined;

  return (
    <>
      {openRound && liveVoting && (
        <LivePanel
          votingId={liveVoting.id}
          title={liveVoting.title}
          masterImage={liveVoting.master_image}
          initialCount={countBallots(openRound.id)}
          voteUrlBase={VOTE_URL}
        />
      )}

      <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Votings</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/voting/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-light"
          >
            + New voting
          </Link>
          <LogoutButton />
        </div>
      </div>

      {votings.length === 0 ? (
        <p className="mt-10 text-center text-slate-400">
          No votings yet. Create your first one.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {votings.map((v) => {
            const count = getItems(v.id).length;
            const isLive = v.id === liveVotingId;
            return (
              <li
                key={v.id}
                className={`flex items-center gap-4 rounded-xl p-4 ring-1 ${
                  isLive
                    ? 'bg-emerald-950/30 ring-emerald-700/50'
                    : 'bg-slate-900 ring-slate-800'
                }`}
              >
                {v.master_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.master_image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-800" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {v.title}
                    {isLive && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/20 px-2 py-0.5 text-xs text-emerald-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Live
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-400">
                    {count} item{count === 1 ? '' : 's'}
                  </p>
                </div>
                <RoundButton
                  votingId={v.id}
                  isLive={isLive}
                  anotherLive={liveVotingId !== null && !isLive}
                />
                <Link
                  href={`/admin/voting/${v.id}`}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
                >
                  Edit
                </Link>
                <DeleteVotingButton id={v.id} title={v.title} />
              </li>
            );
          })}
        </ul>
      )}
      </main>
    </>
  );
}
