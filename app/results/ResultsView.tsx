'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ResultsPayload, ResultItem } from '@/lib/results';

const BAR_COLORS = {
  normal: 'bg-brand',
  eliminated: 'bg-rose-600',
  winner: 'bg-amber-400',
};

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  color: string;
  size: number;
}

function Confetti() {
  // Generated after mount (not during render) so the random values don't cause
  // a server/client hydration mismatch.
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  useEffect(() => {
    const colors = ['#f59e0b', '#8b5cf6', '#22c55e', '#3b82f6', '#ef4444', '#ec4899'];
    setPieces(
      Array.from({ length: 80 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        duration: 1.6 + Math.random() * 1.6,
        rotate: Math.random() * 720 - 360,
        color: colors[i % colors.length],
        size: 8 + Math.random() * 10,
      }))
    );
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -40, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', rotate: p.rotate, opacity: [1, 1, 0.8] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

export default function ResultsView({ data }: { data: ResultsPayload }) {
  const [stage, setStage] = useState(0);
  // Bumped on Replay so the bar list remounts and resets cleanly to round 1,
  // instead of spring-morphing back from the final stage.
  const [cycle, setCycle] = useState(0);
  function replay() {
    setStage(0);
    setCycle((c) => c + 1);
  }
  const itemById = useMemo(() => {
    const m = new Map<number, ResultItem>();
    data.items.forEach((it) => m.set(it.id, it));
    return m;
  }, [data.items]);

  const rounds = data.rounds;
  const lastStage = rounds.length - 1;
  const isFinal = stage === lastStage && data.winnerId !== null;
  const round = rounds[stage];

  // On the final stage the podium already shows the standings, so only show the
  // top few bars (winner + closest contenders) to leave room for the podium —
  // important when a winner takes a first-round majority with a full field.
  const barTallies =
    isFinal && round.tallies.length > 2
      ? round.tallies.slice(0, 2)
      : round.tallies;
  const hiddenCount = round.tallies.length - barTallies.length;

  // Scale the whole row (image, name, bar, number, gap) to how many candidates
  // are left this round, so a crowded early round still fits on one screen
  // without scrolling, and everything grows large as the field narrows.
  const n = round.tallies.length;
  const baseTier =
    n >= 6
      ? {
          img: 'h-14 w-14 md:h-20 md:w-20',
          name: 'text-lg md:text-2xl',
          num: 'text-xl md:text-3xl',
          bar: 'h-4 md:h-5',
          gap: 'gap-2',
        }
      : n === 5
        ? {
            img: 'h-16 w-16 md:h-24 md:w-24',
            name: 'text-xl md:text-3xl',
            num: 'text-2xl md:text-4xl',
            bar: 'h-5 md:h-6',
            gap: 'gap-2 md:gap-3',
          }
        : n <= 3
          ? {
              img: 'h-24 w-24 md:h-36 md:w-36',
              name: 'text-3xl md:text-4xl',
              num: 'text-4xl md:text-5xl',
              bar: 'h-8 md:h-10',
              gap: 'gap-5 md:gap-6',
            }
          : {
              img: 'h-20 w-20 md:h-28 md:w-28',
              name: 'text-2xl md:text-3xl',
              num: 'text-3xl md:text-4xl',
              bar: 'h-6 md:h-8',
              gap: 'gap-3 md:gap-4',
            };
  // On the final stage the podium is also shown, so keep the bars compact to
  // leave room for both on screen.
  const tier = isFinal
    ? {
        img: 'h-12 w-12 md:h-16 md:w-16',
        name: 'text-xl md:text-2xl',
        num: 'text-2xl md:text-3xl',
        bar: 'h-5 md:h-6',
        gap: 'gap-2 md:gap-3',
      }
    : baseTier;

  const caption = (() => {
    if (round.eliminatedId !== null) {
      const name = itemById.get(round.eliminatedId)?.name ?? '';
      const elimVotes = round.tallies.find(
        (t) => t.itemId === round.eliminatedId
      )?.votes;
      if (round.tie) {
        const others = round.tie.tiedIds
          .filter((id) => id !== round.eliminatedId)
          .map((id) => itemById.get(id)?.name ?? '')
          .join(' & ');
        const why =
          round.tie.reason === 'fewer-first-choice'
            ? `${name} goes out because it had fewer first-choice votes`
            : `they're tied even on first-choice votes, so a fixed rule eliminates ${name} (so results are always reproducible)`;
        return `Tie for last at ${round.tie.lowVotes} votes between ${name} & ${others} — ${why}. Those ballots transfer to each voter's next choice.`;
      }
      if (elimVotes === 0) {
        return `No majority yet — ${name} has no votes and is eliminated.`;
      }
      return `No majority yet — ${name} has the fewest votes (${elimVotes}) and is eliminated.`;
    }
    if (round.winnerId !== null) {
      const name = itemById.get(round.winnerId)?.name ?? '';
      return `🎉 ${name} passes the majority of ${round.majority} and wins!`;
    }
    return '';
  })();

  // Compare to the previous round to show how many votes each candidate gained
  // when the last-place candidate was eliminated and their ballots transferred.
  const prevRound = stage > 0 ? rounds[stage - 1] : null;
  const prevVotes = new Map(
    prevRound ? prevRound.tallies.map((t) => [t.itemId, t.votes]) : []
  );
  // Previous standings (among candidates still in this round) → so we can show
  // when a transfer bumped a candidate up or down the order.
  const prevRankOf = new Map<number, number>();
  if (prevRound) {
    prevRound.tallies
      .map((t) => t.itemId)
      .filter((id) => round.tallies.some((rt) => rt.itemId === id))
      .forEach((id, i) => prevRankOf.set(id, i));
  }
  const prevEliminatedName =
    prevRound && prevRound.eliminatedId !== null
      ? itemById.get(prevRound.eliminatedId)?.name ?? ''
      : '';

  // Accurate description of what happened to the previously-eliminated
  // candidate's ballots (transferred vs exhausted vs nothing).
  const prevElimVotes =
    prevRound && prevRound.eliminatedId !== null
      ? prevVotes.get(prevRound.eliminatedId) ?? 0
      : 0;
  const exhaustedGained = prevRound ? round.exhausted - prevRound.exhausted : 0;
  const transferNote = (() => {
    if (stage === 0 || !prevRound) {
      return `Each ballot counts for its top choice. Need a majority (${round.majority}) to win, or the last-place color is eliminated and its ballots transfer.`;
    }
    if (prevElimVotes === 0) {
      return `${prevEliminatedName} had no first-choice votes, so nothing transferred.`;
    }
    const ballotWord = prevElimVotes === 1 ? 'ballot' : 'ballots';
    if (exhaustedGained >= prevElimVotes) {
      return `${prevEliminatedName}'s ${prevElimVotes} ${ballotWord} had no next choice, so they're now exhausted — nothing transferred.`;
    }
    if (exhaustedGained > 0) {
      return `${prevEliminatedName}'s ${prevElimVotes} ${ballotWord} moved to each voter's next choice (green +N below); ${exhaustedGained} had no next choice and are now exhausted.`;
    }
    return `${prevEliminatedName}'s ${prevElimVotes} ${ballotWord} moved to each voter's next choice — the green +N below.`;
  })();

  return (
    <main className="mx-auto flex h-[100svh] w-full max-w-6xl flex-col px-6 py-4 md:px-10 md:py-6">
      {isFinal && <Confetti />}

      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <h1 className="text-4xl font-extrabold md:text-5xl">{data.title}</h1>
        <div className="flex items-center gap-4">
          <span className="text-lg text-slate-400 md:text-xl">
            {data.totalBallots} vote{data.totalBallots === 1 ? '' : 's'} ·{' '}
            {data.status === 'open' ? 'live' : 'final'}
          </span>
          {isFinal && (
            <button
              onClick={replay}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
            >
              ↺ Replay
            </button>
          )}
        </div>
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-6 gap-y-1 text-lg text-slate-300 md:text-xl">
        <span className="font-semibold">
          Round {round.round} of {rounds.length}
        </span>
        <span>{round.continuing} ballots counting</span>
        <span>Majority to win: {round.majority}</span>
        {round.exhausted > 0 && (
          <span className="text-slate-400">
            {round.exhausted} exhausted (no choices left)
          </span>
        )}
      </div>
      <p className="mt-1.5 shrink-0 text-sm text-slate-400 md:text-base">
        {transferNote}
      </p>

      {/* Bars — fill remaining space, vertically centered */}
      <div
        key={cycle}
        className={`flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overflow-x-hidden px-2 py-1 ${tier.gap}`}
      >
        <AnimatePresence mode="popLayout">
          {barTallies.map((t, idx) => {
            const item = itemById.get(t.itemId);
            const eliminated = round.eliminatedId === t.itemId;
            const winner = isFinal && data.winnerId === t.itemId;
            const color = winner
              ? BAR_COLORS.winner
              : eliminated
                ? BAR_COLORS.eliminated
                : BAR_COLORS.normal;
            const delta = prevRound ? t.votes - (prevVotes.get(t.itemId) ?? 0) : 0;
            // Bars are scaled to the majority threshold, so a bar only fills
            // all the way when that color crosses the line and wins. The slice
            // gained from the just-eliminated color is shown in green.
            const totalPct = Math.min(100, (t.votes / round.majority) * 100);
            const transferPct = t.votes > 0 ? totalPct * (delta / t.votes) : 0;
            const basePct = totalPct - transferPct;
            const prevRank = prevRankOf.get(t.itemId);
            const rankUp = prevRank !== undefined ? prevRank - idx : 0;
            return (
              <motion.div
                key={t.itemId}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: -60, height: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                className={`flex items-center gap-4 rounded-2xl p-1.5 md:gap-5 md:p-2 ${
                  winner ? 'bg-amber-400/10 ring-2 ring-amber-400/60' : ''
                } ${eliminated ? 'ring-2 ring-rose-600/50' : ''}`}
              >
                {item?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt=""
                    className={`${tier.img} shrink-0 rounded-xl object-cover`}
                  />
                ) : (
                  <div className={`${tier.img} shrink-0 rounded-xl bg-slate-800`} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className={`flex items-center gap-2 truncate font-semibold ${tier.name}`}>
                      {winner && <span>👑</span>}
                      {item?.name}
                      {eliminated && (
                        <span className="rounded bg-rose-600/20 px-2 py-1 text-sm font-medium text-rose-300 md:text-base">
                          Eliminated
                        </span>
                      )}
                      {delta > 0 && (
                        <span className="rounded bg-emerald-500/25 px-2 py-0.5 text-sm font-semibold text-emerald-300">
                          +{delta}
                        </span>
                      )}
                      {!eliminated && rankUp > 0 && (
                        <span className="text-sm font-bold text-emerald-400" title="moved up">
                          ▲{rankUp}
                        </span>
                      )}
                      {!eliminated && rankUp < 0 && (
                        <span className="text-sm font-bold text-slate-500" title="moved down">
                          ▼{-rankUp}
                        </span>
                      )}
                    </span>
                    <span className={`ml-3 font-bold tabular-nums ${tier.num}`}>
                      {t.votes}
                    </span>
                  </div>
                  <div className={`flex overflow-hidden rounded-full bg-slate-800 ${tier.bar}`}>
                    {/* existing votes */}
                    <motion.div
                      className={`h-full ${color}`}
                      initial={false}
                      animate={{ width: `${basePct}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                    {/* votes transferred in from the eliminated color */}
                    {transferPct > 0 && (
                      <motion.div
                        className="h-full bg-emerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${transferPct}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 18, delay: 0.3 }}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {hiddenCount > 0 && (
          <p className="shrink-0 pt-1 text-center text-sm text-slate-500">
            +{hiddenCount} more below — see the full standings on the podium
          </p>
        )}
      </div>

      {caption && (
        <motion.p
          key={`cap-${stage}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="shrink-0 text-center text-xl text-slate-200 md:text-2xl"
        >
          {caption}
        </motion.p>
      )}

      {/* Podium */}
      {isFinal && <Podium placements={data.placements} itemById={itemById} />}

      {/* Controls */}
      <div className="mt-5 flex shrink-0 items-center justify-center gap-4">
        <button
          onClick={() => setStage((s) => Math.max(0, s - 1))}
          disabled={stage === 0}
          className="rounded-xl border border-slate-700 px-7 py-3.5 text-lg hover:bg-slate-800 disabled:opacity-40"
        >
          ← Previous
        </button>
        {stage < lastStage && (
          <button
            onClick={() => setStage((s) => Math.min(lastStage, s + 1))}
            className="rounded-xl bg-brand px-9 py-3.5 text-lg font-semibold text-white hover:bg-brand-light"
          >
            Next stage →
          </button>
        )}
      </div>
    </main>
  );
}

function Podium({
  placements,
  itemById,
}: {
  placements: number[];
  itemById: Map<number, ResultItem>;
}) {
  // Display order: 2nd, 1st, 3rd
  const slots = [
    { place: 2, id: placements[1], h: 'h-24 md:h-32', medal: '🥈', delay: 0.1 },
    { place: 1, id: placements[0], h: 'h-36 md:h-48', medal: '🥇', delay: 0 },
    { place: 3, id: placements[2], h: 'h-16 md:h-24', medal: '🥉', delay: 0.2 },
  ].filter((s) => s.id !== undefined);

  return (
    <div className="mt-4 shrink-0">
      <div className="flex items-end justify-center gap-3 md:gap-6">
        {slots.map((s) => {
          const item = itemById.get(s.id!);
          return (
            <motion.div
              key={s.place}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + s.delay, type: 'spring', stiffness: 200 }}
              className="flex w-32 flex-col items-center md:w-44"
            >
              <div className="text-4xl md:text-5xl">{s.medal}</div>
              {item?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt=""
                  className="my-2 h-16 w-16 rounded-xl object-cover ring-2 ring-slate-700 md:h-24 md:w-24"
                />
              ) : (
                <div className="my-2 h-16 w-16 rounded-xl bg-slate-800 md:h-24 md:w-24" />
              )}
              <p className="mb-2 max-w-full truncate text-center text-base font-medium md:text-lg">
                {item?.name}
              </p>
              <div
                className={`flex w-full ${s.h} items-start justify-center rounded-t-lg bg-gradient-to-t ${
                  s.place === 1
                    ? 'from-amber-500/30 to-amber-400/60'
                    : s.place === 2
                      ? 'from-slate-500/30 to-slate-300/50'
                      : 'from-orange-700/30 to-orange-500/50'
                } pt-2 text-2xl font-bold md:text-3xl`}
              >
                {s.place}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
