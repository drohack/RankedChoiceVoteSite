'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';

export default function LivePanel({
  votingId,
  title,
  masterImage,
  initialCount,
  voteUrlBase,
}: {
  votingId: number;
  title: string;
  masterImage: string | null;
  initialCount: number;
  /** Public base URL (from the VOTE_URL env, runtime). Empty → use origin. */
  voteUrlBase: string;
}) {
  const router = useRouter();
  const [voteUrl, setVoteUrl] = useState('');
  const [qr, setQr] = useState('');
  const [count, setCount] = useState(initialCount);
  const [copied, setCopied] = useState(false);
  const [stopping, setStopping] = useState(false);

  // Build the public voting URL (VOTE_URL env override, else current origin).
  useEffect(() => {
    const base = (voteUrlBase || window.location.origin).replace(/\/$/, '');
    const url = `${base}/`;
    setVoteUrl(url);
    // High resolution so it stays crisp when scaled up on a big screen.
    QRCode.toDataURL(url, { width: 1200, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => setQr(''));
  }, [voteUrlBase]);

  // Poll live status: keep the count fresh; if the round is no longer this
  // voting's open round, refresh the page so the UI reflects the new state.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/admin/status', { cache: 'no-store' });
        const data = await res.json();
        if (!active) return;
        if (!data.open || data.open.votingId !== votingId) {
          router.refresh();
          return;
        }
        setCount(data.open.ballotCount);
      } catch {
        /* ignore transient errors */
      }
    };
    const interval = setInterval(tick, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [votingId, router]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(voteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard may be unavailable */
    }
  }

  async function stop() {
    setStopping(true);
    await fetch(`/api/admin/votings/${votingId}/stop`, { method: 'POST' });
    router.refresh();
  }

  return (
    // Exactly one viewport tall so the image, QR and link are always visible
    // without scrolling, at any screen size. The list sits below the fold.
    <section className="flex h-[100svh] flex-col border-b border-emerald-700/40 bg-emerald-950/20">
      {/* header (fixed height) */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-600/20 px-3 py-1 text-sm font-medium text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Live now
          </span>
          <h2 className="text-2xl font-bold">{title}</h2>
          <span className="text-slate-400">
            · <span className="font-semibold text-slate-200">{count}</span> vote
            {count === 1 ? '' : 's'} cast
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/results"
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Open results →
          </Link>
          <button
            onClick={stop}
            disabled={stopping}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
          >
            {stopping ? 'Stopping…' : 'Stop'}
          </button>
        </div>
      </div>

      {/* Big two-pane area that fills remaining height. Both panes scale to fit. */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 lg:flex-row lg:gap-8 lg:p-6">
        {/* Master image pane */}
        <div className="flex min-h-0 flex-1 items-center justify-center">
          {masterImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={masterImage}
              alt={title}
              className="max-h-full max-w-full rounded-2xl object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
              No master image
            </div>
          )}
        </div>

        {/* QR + link pane */}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          {/* QR fills the available height while staying square */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code to the voting page"
                className="aspect-square h-full max-h-full w-auto max-w-full rounded-2xl bg-white p-3 object-contain"
              />
            ) : (
              <div className="aspect-square h-full rounded-2xl bg-slate-800" />
            )}
          </div>

          {/* Link (always visible) */}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-3">
            <code className="break-all rounded-xl bg-slate-900 px-5 py-3 text-2xl font-semibold text-emerald-300 md:text-3xl">
              {voteUrl || '…'}
            </code>
            <button
              onClick={copy}
              className="rounded-xl border border-slate-600 px-4 py-3 text-base hover:bg-slate-800"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
