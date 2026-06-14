import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { __setTestDbToMemory, __closeDb } from './db';
import {
  createVoting,
  replaceItems,
  getItems,
  startRound,
  stopRound,
  insertBallot,
} from './queries';
import { buildResults } from './results';

beforeEach(() => {
  __setTestDbToMemory();
});
afterAll(() => {
  __closeDb();
});

function seedVoting(): { votingId: number; ids: number[] } {
  const votingId = createVoting('Best Color', '/uploads/m.webp');
  replaceItems(votingId, [
    { name: 'Crimson', image: null },
    { name: 'Emerald', image: null },
    { name: 'Azure', image: null },
  ]);
  const ids = getItems(votingId).map((i) => i.id);
  return { votingId, ids };
}

describe('buildResults', () => {
  it('returns null when no round has ever started', () => {
    seedVoting();
    expect(buildResults()).toBeNull();
  });

  it('computes results for the open round end-to-end', () => {
    const { votingId, ids } = seedVoting();
    const [crimson, emerald, azure] = ids;
    const round = startRound(votingId);

    // Crimson 4, Emerald 3, Azure 2 → Azure eliminated, its ballots go to
    // Emerald → Emerald 5 wins. Placements: Emerald, Crimson, Azure.
    for (let i = 0; i < 4; i++) insertBallot(round, [crimson, emerald]);
    for (let i = 0; i < 3; i++) insertBallot(round, [emerald, crimson]);
    for (let i = 0; i < 2; i++) insertBallot(round, [azure, emerald]);

    const res = buildResults();
    expect(res).not.toBeNull();
    expect(res!.title).toBe('Best Color');
    expect(res!.status).toBe('open');
    expect(res!.totalBallots).toBe(9);
    expect(res!.items).toHaveLength(3);
    expect(res!.winnerId).toBe(emerald);
    expect(res!.placements).toEqual([emerald, crimson, azure]);
    expect(res!.rounds.length).toBe(2);
    expect(res!.rounds[0].eliminatedId).toBe(azure);
  });

  it('still reports results for a closed round (status: closed)', () => {
    const { votingId, ids } = seedVoting();
    const round = startRound(votingId);
    insertBallot(round, [ids[0]]);
    stopRound(round);

    const res = buildResults();
    expect(res?.status).toBe('closed');
    expect(res?.winnerId).toBe(ids[0]);
  });

  it('handles a round with zero ballots (no rounds, no winner)', () => {
    const { votingId } = seedVoting();
    startRound(votingId);
    const res = buildResults();
    expect(res?.totalBallots).toBe(0);
    expect(res?.rounds).toEqual([]);
    expect(res?.winnerId).toBeNull();
  });
});
