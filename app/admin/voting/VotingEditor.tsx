'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VotingWithItems } from '@/lib/types';

interface ItemDraft {
  key: string;
  name: string;
  image: string | null;
}

let keyCounter = 0;
function newKey() {
  keyCounter += 1;
  return `k${keyCounter}`;
}

async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/upload', { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Upload failed');
  return data.url as string;
}

/** Small image picker with preview, used for the master image and each item. */
function ImageField({
  value,
  onChange,
  label,
  size = 'lg',
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  label: string;
  size?: 'lg' | 'sm';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const dim = size === 'lg' ? 'h-28 w-28' : 'h-16 w-16';

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadFile(file);
      onChange(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={`${dim} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-600 bg-slate-950 text-xs text-slate-400 hover:border-brand-light`}
        aria-label={label}
      >
        {busy ? (
          'Uploading…'
        ) : value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} className="h-full w-full object-cover" />
        ) : (
          '+ Image'
        )}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-slate-400 underline hover:text-rose-400"
        >
          Remove
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPick}
      />
    </div>
  );
}

export default function VotingEditor({
  initial,
}: {
  initial?: VotingWithItems;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [masterImage, setMasterImage] = useState<string | null>(
    initial?.master_image ?? null
  );
  const [items, setItems] = useState<ItemDraft[]>(
    initial?.items.map((it) => ({
      key: newKey(),
      name: it.name,
      image: it.image,
    })) ?? [
      { key: newKey(), name: '', image: null },
      { key: newKey(), name: '', image: null },
    ]
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function updateItem(key: string, patch: Partial<ItemDraft>) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, ...patch } : it))
    );
  }
  function addItem() {
    setItems((prev) => [...prev, { key: newKey(), name: '', image: null }]);
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }
  function move(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.key === key);
      const swap = idx + dir;
      if (idx < 0 || swap < 0 || swap >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  async function save() {
    setError('');
    if (title.trim().length === 0) {
      setError('Please enter a title.');
      return;
    }
    const cleanItems = items
      .map((it) => ({ name: it.name.trim(), image: it.image }))
      .filter((it) => it.name.length > 0);
    if (cleanItems.length < 2) {
      setError('Add at least two named items to vote on.');
      return;
    }

    setSaving(true);
    try {
      const isEdit = Boolean(initial);
      const res = await fetch(
        isEdit ? `/api/admin/votings/${initial!.id}` : '/api/admin/votings',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            masterImage,
            items: cleanItems,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Save failed.');
        return;
      }
      router.push('/admin');
      router.refresh();
    } catch {
      setError('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">
        {initial ? 'Edit voting' : 'New voting'}
      </h1>

      <label className="mt-6 block text-sm text-slate-400">Title</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Best logo design"
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-brand-light"
      />

      <div className="mt-6">
        <span className="block text-sm text-slate-400">Master image</span>
        <p className="mb-2 text-xs text-slate-500">
          Shown at the top of the voting page (optional).
        </p>
        <ImageField
          value={masterImage}
          onChange={setMasterImage}
          label="Master image"
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-medium">Items</h2>
        <button
          type="button"
          onClick={addItem}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800"
        >
          + Add item
        </button>
      </div>

      <ul className="mt-3 space-y-3">
        {items.map((it, idx) => (
          <li
            key={it.key}
            className="flex items-center gap-3 rounded-xl bg-slate-900 p-3 ring-1 ring-slate-800"
          >
            <span className="w-5 shrink-0 text-center text-sm text-slate-500">
              {idx + 1}
            </span>
            <ImageField
              value={it.image}
              onChange={(url) => updateItem(it.key, { image: url })}
              label={`Item ${idx + 1} image`}
              size="sm"
            />
            <input
              value={it.name}
              onChange={(e) => updateItem(it.key, { name: e.target.value })}
              placeholder={`Item ${idx + 1} name`}
              className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-brand-light"
            />
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(it.key, -1)}
                disabled={idx === 0}
                className="px-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(it.key, 1)}
                disabled={idx === items.length - 1}
                className="px-1 text-slate-400 hover:text-slate-100 disabled:opacity-30"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(it.key)}
              className="shrink-0 px-1 text-slate-400 hover:text-rose-400"
              aria-label="Remove item"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mt-5 text-sm text-rose-400">{error}</p>}

      <div className="mt-8 flex gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-light disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => router.push('/admin')}
          className="rounded-lg border border-slate-700 px-5 py-2.5 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </main>
  );
}
