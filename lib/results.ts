import {
  getLatestRoundAny,
  getOpenRound,
  getVotingWithItems,
  getBallots,
} from './queries';
import { computeRCV, type RoundResult } from './rcv';

export interface ResultItem {
  id: number;
  name: string;
  image: string | null;
}

export interface ResultsPayload {
  title: string;
  status: 'open' | 'closed';
  items: ResultItem[];
  rounds: RoundResult[];
  winnerId: number | null;
  placements: number[];
  totalBallots: number;
}

/**
 * Build the results payload for the current/most-recent voting round. Prefers
 * the open round; otherwise uses the latest round overall. Returns null if no
 * round has ever been started.
 */
export function buildResults(): ResultsPayload | null {
  const round = getOpenRound() ?? getLatestRoundAny();
  if (!round) return null;

  const voting = getVotingWithItems(round.voting_id);
  if (!voting) return null;

  const ballots = getBallots(round.id).map(
    (b) => JSON.parse(b.ranking_json) as number[]
  );
  const itemIds = voting.items.map((it) => it.id);
  const rcv = computeRCV(itemIds, ballots);

  return {
    title: voting.title,
    status: round.status,
    items: voting.items.map((it) => ({
      id: it.id,
      name: it.name,
      image: it.image,
    })),
    rounds: rcv.rounds,
    winnerId: rcv.winnerId,
    placements: rcv.placements,
    totalBallots: rcv.totalBallots,
  };
}
