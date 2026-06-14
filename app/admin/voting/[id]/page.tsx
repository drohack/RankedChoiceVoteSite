import { notFound } from 'next/navigation';
import { getVotingWithItems } from '@/lib/queries';
import VotingEditor from '../VotingEditor';

export const dynamic = 'force-dynamic';

export default async function EditVotingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const voting = getVotingWithItems(Number(id));
  if (!voting) notFound();
  return <VotingEditor initial={voting} />;
}
