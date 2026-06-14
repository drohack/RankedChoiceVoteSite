import Link from 'next/link';
import { buildResults } from '@/lib/results';
import ResultsView from './ResultsView';

export const dynamic = 'force-dynamic';

export default function ResultsPage() {
  const data = buildResults();

  if (!data || data.rounds.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-semibold">No results to show yet</h1>
        <p className="mt-2 text-slate-400">
          {data
            ? 'No votes have been cast in this round.'
            : 'Start a vote and collect some ballots first.'}
        </p>
        <Link
          href="/admin"
          className="mt-6 rounded-lg border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        >
          ← Back to admin
        </Link>
      </main>
    );
  }

  return <ResultsView data={data} />;
}
