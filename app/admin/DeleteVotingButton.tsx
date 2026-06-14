'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteVotingButton({
  id,
  title,
}: {
  id: number;
  title: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!confirm(`Delete "${title}"? This removes its items and all votes.`)) {
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/admin/votings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      router.refresh();
    } else {
      alert('Delete failed.');
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-rose-900/40 hover:text-rose-300 disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
