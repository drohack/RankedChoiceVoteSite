'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RoundButton({
  votingId,
  isLive,
  anotherLive,
}: {
  votingId: number;
  isLive: boolean;
  anotherLive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(action: 'start' | 'stop') {
    if (
      action === 'start' &&
      anotherLive &&
      !confirm('Another vote is live. Starting this one will stop it. Continue?')
    ) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/votings/${votingId}/${action}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data?.error || `Could not ${action} the vote.`);
      setBusy(false);
      return;
    }
    router.refresh();
    setBusy(false);
  }

  if (isLive) {
    return (
      <button
        onClick={() => act('stop')}
        disabled={busy}
        className="rounded-lg bg-rose-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
      >
        {busy ? 'Stopping…' : 'Stop'}
      </button>
    );
  }
  return (
    <button
      onClick={() => act('start')}
      disabled={busy}
      className="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
    >
      {busy ? 'Starting…' : 'Start'}
    </button>
  );
}
