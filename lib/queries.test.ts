import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { __setTestDbToMemory, __closeDb } from './db';
import {
  createVoting,
  getVoting,
  listVotings,
  updateVoting,
  deleteVoting,
  replaceItems,
  getItems,
  getVotingWithItems,
  startRound,
  stopRound,
  getOpenRound,
  getRound,
  getLatestRoundAny,
  closeOpenRoundsForVoting,
  insertBallot,
  getBallots,
  countBallots,
} from './queries';

// Real in-memory SQLite per test — no mocks, full isolation.
beforeEach(() => {
  __setTestDbToMemory();
});
afterAll(() => {
  __closeDb();
});

describe('votings & items', () => {
  it('creates, reads, updates, and lists votings', () => {
    const id = createVoting('Colors', '/uploads/m.webp');
    expect(getVoting(id)?.title).toBe('Colors');
    updateVoting(id, 'New Title', null);
    expect(getVoting(id)?.title).toBe('New Title');
    expect(getVoting(id)?.master_image).toBeNull();
    expect(listVotings()).toHaveLength(1);
  });

  it('replaces items and preserves order', () => {
    const id = createVoting('V', null);
    replaceItems(id, [
      { name: 'A', image: null },
      { name: 'B', image: '/uploads/b.webp' },
      { name: 'C', image: null },
    ]);
    const items = getItems(id);
    expect(items.map((i) => i.name)).toEqual(['A', 'B', 'C']);
    expect(items.map((i) => i.sort_order)).toEqual([0, 1, 2]);

    // Replacing wipes the old set.
    replaceItems(id, [{ name: 'Z', image: null }]);
    expect(getItems(id).map((i) => i.name)).toEqual(['Z']);
  });

  it('cascade-deletes items and rounds when a voting is removed', () => {
    const id = createVoting('V', null);
    replaceItems(id, [{ name: 'A', image: null }]);
    const round = startRound(id);
    insertBallot(round, [1]);
    deleteVoting(id);
    expect(getVoting(id)).toBeUndefined();
    expect(getItems(id)).toHaveLength(0);
    expect(getRound(round)).toBeUndefined();
  });

  it('getVotingWithItems joins items', () => {
    const id = createVoting('V', null);
    replaceItems(id, [{ name: 'A', image: null }, { name: 'B', image: null }]);
    expect(getVotingWithItems(id)?.items).toHaveLength(2);
  });
});

describe('round lifecycle (voting blocks)', () => {
  it('starting a round opens exactly one, and only one is ever open', () => {
    const a = createVoting('A', null);
    const b = createVoting('B', null);
    const r1 = startRound(a);
    expect(getOpenRound()?.id).toBe(r1);

    // Starting another round (even for a different voting) closes the previous.
    const r2 = startRound(b);
    expect(getOpenRound()?.id).toBe(r2);
    expect(getRound(r1)?.status).toBe('closed');
  });

  it('stopRound closes the open round', () => {
    const id = createVoting('A', null);
    const r = startRound(id);
    stopRound(r);
    expect(getOpenRound()).toBeUndefined();
    expect(getRound(r)?.status).toBe('closed');
    expect(getRound(r)?.ended_at).not.toBeNull();
  });

  it('closeOpenRoundsForVoting invalidates an open round (edit case)', () => {
    const id = createVoting('A', null);
    startRound(id);
    closeOpenRoundsForVoting(id);
    expect(getOpenRound()).toBeUndefined();
  });

  it('votes never carry across a new round (the core invariant)', () => {
    const id = createVoting('A', null);
    replaceItems(id, [{ name: 'A', image: null }, { name: 'B', image: null }]);
    const r1 = startRound(id);
    insertBallot(r1, [1, 2]);
    insertBallot(r1, [2]);
    expect(countBallots(r1)).toBe(2);

    // A new round starts fresh; the old ballots stay tied to the closed round.
    const r2 = startRound(id);
    expect(countBallots(r2)).toBe(0);
    expect(countBallots(r1)).toBe(2);
    expect(getLatestRoundAny()?.id).toBe(r2);
  });
});

describe('ballots', () => {
  it('stores and reads back ranking JSON in order', () => {
    const id = createVoting('A', null);
    const r = startRound(id);
    insertBallot(r, [3, 1, 2]);
    const ballots = getBallots(r);
    expect(ballots).toHaveLength(1);
    expect(JSON.parse(ballots[0].ranking_json)).toEqual([3, 1, 2]);
    expect(countBallots(r)).toBe(1);
  });
});
