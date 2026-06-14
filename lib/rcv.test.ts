import { describe, it, expect } from 'vitest';
import { computeRCV } from './rcv';

describe('computeRCV', () => {
  it('declares a first-round majority winner', () => {
    // A=3 of 5 first-choice votes → majority in round 1.
    const r = computeRCV(
      [1, 2, 3],
      [[1], [1], [1], [2], [3]]
    );
    expect(r.rounds).toHaveLength(1);
    expect(r.winnerId).toBe(1);
    expect(r.rounds[0].eliminatedId).toBeNull();
    expect(r.rounds[0].majority).toBe(3);
    // Winner first; the other two follow.
    expect(r.placements[0]).toBe(1);
    expect(r.placements).toHaveLength(3);
  });

  it('eliminates the lowest and redistributes to find a majority', () => {
    // First choices: A=4, B=3, C=2 (total 9, majority 5). C eliminated; its two
    // voters' 2nd choice is B → B=5 → B wins. Expected placements: B, A, C.
    const ballots: number[][] = [
      ...Array(4).fill([1, 3]), // A>C
      ...Array(3).fill([2, 3]), // B>C
      ...Array(2).fill([3, 2]), // C>B
    ];
    const r = computeRCV([1, 2, 3], ballots);
    expect(r.rounds).toHaveLength(2);
    expect(r.rounds[0].eliminatedId).toBe(3); // C eliminated first
    expect(r.winnerId).toBe(2); // B wins
    expect(r.placements).toEqual([2, 1, 3]); // B, A, C
  });

  it('counts exhausted ballots when a voter only ranked an eliminated candidate', () => {
    // A=2, B=2, C=1. C eliminated round 1; the lone C ballot ranks nothing else
    // → exhausted in round 2.
    const ballots: number[][] = [
      [1],
      [1],
      [2],
      [2],
      [3], // only ranks C
    ];
    const r = computeRCV([1, 2, 3], ballots);
    expect(r.rounds[0].eliminatedId).toBe(3);
    // Round 2: 4 continuing, 1 exhausted.
    expect(r.rounds[1].exhausted).toBe(1);
    expect(r.rounds[1].continuing).toBe(4);
    expect(r.winnerId).not.toBeNull();
    // C finishes last.
    expect(r.placements[r.placements.length - 1]).toBe(3);
  });

  it('breaks ties deterministically (same input → same winner)', () => {
    // A and B tie everywhere; tiebreak must be stable across runs.
    const ballots: number[][] = [[1], [2]];
    const a = computeRCV([1, 2], ballots);
    const b = computeRCV([1, 2], ballots);
    expect(a.winnerId).toBe(b.winnerId);
    expect(a.placements).toEqual(b.placements);
    // With equal votes and equal first-choice, lower id wins the standing.
    expect(a.winnerId).toBe(1);
  });

  it('produces a 1st/2nd/3rd podium for a multi-candidate race', () => {
    // 5 candidates, enough rounds to rank a podium.
    const ballots: number[][] = [
      ...Array(5).fill([1, 2, 3]),
      ...Array(4).fill([2, 1, 3]),
      ...Array(3).fill([3, 2, 1]),
      ...Array(2).fill([4, 3, 2]),
      ...Array(1).fill([5, 4, 3]),
    ];
    const r = computeRCV([1, 2, 3, 4, 5], ballots);
    expect(r.placements).toHaveLength(5);
    expect(r.winnerId).toBe(r.placements[0]);
    // 5 (1 first-choice) should be eliminated before 4 (2 first-choice).
    const elimOrder = r.rounds
      .map((rd) => rd.eliminatedId)
      .filter((x): x is number => x !== null);
    expect(elimOrder[0]).toBe(5);
  });

  it('records tie-break details when last place is tied (no majority)', () => {
    // Items A=1, B=2, C=3, D=4. First choices: A=3, B=3, C=1, D=1 (total 8,
    // majority 5 → nobody wins). C and D tie for last at 1, with equal
    // first-choice votes, so the tie is broken by the fixed rule.
    const r = computeRCV(
      [1, 2, 3, 4],
      [[1], [1], [1], [2], [2], [2], [3], [4]]
    );
    const elimRound = r.rounds[0];
    expect(elimRound.tie).toBeDefined();
    expect(elimRound.tie?.tiedIds.sort()).toEqual([3, 4]);
    expect(elimRound.tie?.lowVotes).toBe(1);
    expect(elimRound.tie?.reason).toBe('fixed');
  });

  it('breaks a last-place tie by fewer first-choice votes', () => {
    // Items A=1, B=2, C=3, D=4.
    // First choices: A=4, B=3, C=2, D=1 → D eliminated round 1; D's ballot → C.
    // Round 2: A=4, B=3, C=3 → B and C tie at 3, but C had fewer ORIGINAL
    // first-choice votes (2 vs 3), so C is eliminated for that reason.
    const ballots: number[][] = [
      [1], [1], [1], [1], // A first x4
      [2], [2], [2], // B first x3
      [3], [3], // C first x2
      [4, 3], // D first, then C
    ];
    const r = computeRCV([1, 2, 3, 4], ballots);
    const round2 = r.rounds[1];
    expect(round2.eliminatedId).toBe(3); // C eliminated
    expect(round2.tie?.tiedIds.sort()).toEqual([2, 3]);
    expect(round2.tie?.reason).toBe('fewer-first-choice');
  });

  it('lets a first-round leader lose after transfers (come-from-behind)', () => {
    // First choices: A=6, B=5, C=4 (total 15, majority 8). A leads but no
    // majority. C eliminated; all C ballots list B next → B = 9 → B wins.
    const ballots: number[][] = [
      ...Array(6).fill([1]),
      ...Array(5).fill([2]),
      ...Array(4).fill([3, 2]),
    ];
    const r = computeRCV([1, 2, 3], ballots);
    expect(r.rounds[0].eliminatedId).toBe(3);
    expect(r.winnerId).toBe(2); // B wins despite trailing in round 1
    expect(r.placements).toEqual([2, 1, 3]);
  });

  it('wins exactly at the majority threshold', () => {
    // 4 ballots, A=2,B=1,C=1 → majority 3. No majority round 1; C eliminated,
    // C→A → A=3 = majority exactly. A wins.
    const r = computeRCV([1, 2, 3], [[1], [1], [2], [3, 1]]);
    expect(r.rounds[0].majority).toBe(3);
    expect(r.winnerId).toBe(1);
    const finalA = r.rounds[r.rounds.length - 1].tallies.find((t) => t.itemId === 1);
    expect(finalA?.votes).toBe(3);
  });

  it('resolves an even two-way split by eliminating to one survivor', () => {
    // A=2, B=2 → majority 3, neither reaches it. One is eliminated by the
    // tie-break and the other wins as the last standing.
    const r = computeRCV([1, 2], [[1], [1], [2], [2]]);
    expect(r.winnerId).not.toBeNull();
    expect(r.placements.sort()).toEqual([1, 2]);
    // The eliminated round should record the two-way tie.
    expect(r.rounds[0].tie?.tiedIds.sort()).toEqual([1, 2]);
  });

  it('breaks a three-way tie for last deterministically', () => {
    // A=5, B=2, C=2, D=2 (total 11, majority 6). B,C,D tie for last.
    const ballots: number[][] = [
      ...Array(5).fill([1]),
      ...Array(2).fill([2]),
      ...Array(2).fill([3]),
      ...Array(2).fill([4]),
    ];
    const r1 = computeRCV([1, 2, 3, 4], ballots);
    const r2 = computeRCV([1, 2, 3, 4], ballots);
    expect(r1.rounds[0].tie?.tiedIds.sort()).toEqual([2, 3, 4]);
    expect(r1.rounds[0].eliminatedId).toBe(r2.rounds[0].eliminatedId); // deterministic
    expect(r1.winnerId).toBe(1);
  });

  it('still produces a winner when most ballots exhaust', () => {
    // Everyone bullet-votes a single candidate; as candidates are eliminated
    // their ballots exhaust, but a winner still emerges (last standing).
    const r = computeRCV(
      [1, 2, 3, 4],
      [[1], [1], [2], [2], [3], [4]]
    );
    expect(r.winnerId).not.toBeNull();
    expect(new Set(r.placements).size).toBe(4);
    // Exhausted count should grow across rounds as bullet ballots drop out.
    const lastRound = r.rounds[r.rounds.length - 1];
    expect(lastRound.exhausted).toBeGreaterThan(0);
  });

  it('keeps the continuing/exhausted/majority numbers consistent each round', () => {
    const ballots: number[][] = [
      [1, 2], [1], [2, 3], [3], [4, 1], [4], [2], [3, 4],
    ];
    const r = computeRCV([1, 2, 3, 4], ballots);
    for (const round of r.rounds) {
      const counted = round.tallies.reduce((s, t) => s + t.votes, 0);
      // Every ballot is either counted for an active candidate or exhausted.
      expect(counted + round.exhausted).toBe(r.totalBallots);
      expect(round.continuing).toBe(counted);
      expect(round.majority).toBe(Math.floor(round.continuing / 2) + 1);
    }
  });

  it('handles an empty ballot set', () => {
    const r = computeRCV([1, 2, 3], []);
    expect(r.winnerId).toBeNull();
    expect(r.placements).toEqual([]);
    expect(r.rounds).toEqual([]);
  });

  it('handles a single candidate', () => {
    const r = computeRCV([1], [[1], [1]]);
    expect(r.winnerId).toBe(1);
    expect(r.placements).toEqual([1]);
    expect(r.rounds).toHaveLength(1);
  });

  it('every placement is unique and covers all candidates', () => {
    const ballots: number[][] = [
      [1, 2],
      [2, 3],
      [3, 1],
      [4],
      [1, 4],
    ];
    const r = computeRCV([1, 2, 3, 4], ballots);
    expect(new Set(r.placements).size).toBe(r.placements.length);
    expect(r.placements.sort()).toEqual([1, 2, 3, 4]);
  });
});
