'use client';

import { useMemo, useState } from 'react';
import type { Item } from '@/lib/types';

export default function VotingForm({
  title,
  masterImage,
  items,
}: {
  title: string;
  masterImage: string | null;
  items: Item[];
}) {
  // ranking holds item ids in preference order (index 0 = first choice).
  const [ranking, setRanking] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const rankOf = useMemo(() => {
    const map = new Map<number, number>();
    ranking.forEach((id, idx) => map.set(id, idx + 1));
    return map;
  }, [ranking]);

  function toggle(id: number) {
    setError('');
    setRanking((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function submit() {
    if (ranking.length === 0) {
      setError('Tap at least one choice to rank it.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ranking }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDone(true);
      } else {
        setError(data?.error || 'Could not submit your vote.');
      }
    } catch {
      setError('Network error. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="text-6xl">✅</div>
        <h1 className="mt-4 text-2xl font-semibold">Thanks for voting!</h1>
        <p className="mt-2 text-slate-400">Your ranking has been recorded.</p>
      </main>
    );
  }

  const itemById = new Map(items.map((it) => [it.id, it]));

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 pb-36 pt-6">
      {masterImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={masterImage}
          alt=""
          className="mb-4 h-40 w-full rounded-2xl object-cover"
        />
      )}
      <h1 className="text-2xl font-bold leading-tight">{title}</h1>
      <p className="mt-2 text-sm text-slate-400">
        Tap items to rank them — your first tap is your #1 choice. You don&apos;t
        have to rank them all. Tap again to remove.
      </p>

      {/* Your ranking summary */}
      {ranking.length > 0 && (
        <div className="mt-4 rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
            Your ranking
          </p>
          <ol className="space-y-1">
            {ranking.map((id, idx) => (
              <li key={id} className="flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                  {idx + 1}
                </span>
                <span className="truncate">{itemById.get(id)?.name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <ul className="mt-4 space-y-3">
        {items.map((it) => {
          const rank = rankOf.get(it.id);
          const selected = rank !== undefined;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => toggle(it.id)}
                aria-pressed={selected}
                className={`tap-target flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
                  selected
                    ? 'border-brand-light bg-brand/15'
                    : 'border-slate-800 bg-slate-900 active:bg-slate-800'
                }`}
              >
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.image}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-800" />
                )}
                <span className="min-w-0 flex-1 truncate text-lg font-medium">
                  {it.name}
                </span>
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-bold ${
                    selected
                      ? 'bg-brand text-white'
                      : 'border border-slate-600 text-slate-500'
                  }`}
                >
                  {selected ? rank : ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-md">
          {error && <p className="mb-2 text-center text-sm text-rose-400">{error}</p>}
          <button
            onClick={submit}
            disabled={submitting || ranking.length === 0}
            className="tap-target w-full rounded-2xl bg-brand text-lg font-semibold text-white transition enabled:hover:bg-brand-light disabled:opacity-40"
          >
            {submitting
              ? 'Submitting…'
              : ranking.length === 0
                ? 'Tap items to rank'
                : `Submit ${ranking.length} choice${ranking.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </main>
  );
}
