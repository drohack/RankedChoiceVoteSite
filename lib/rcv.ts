/**
 * Instant-runoff (ranked choice) vote tabulation.
 *
 * Pure functions over item ids + ballots so the logic is unit-testable in
 * isolation. Names/images are joined in by the caller for display.
 *
 * The result includes a per-round trace (tallies, who was eliminated, exhausted
 * ballot count) so the results page can animate each stage, plus final
 * placements derived from reverse elimination order.
 */

export interface Tally {
  itemId: number;
  votes: number;
}

export interface RoundResult {
  round: number; // 1-based
  /** Candidates still active at the START of this round, sorted by votes desc. */
  tallies: Tally[];
  /** Votes needed to win this round (> half of continuing ballots). */
  majority: number;
  /** Ballots still counting toward an active candidate this round. */
  continuing: number;
  /** Ballots whose ranked choices are all eliminated. */
  exhausted: number;
  /** The candidate eliminated this round, or null if this round produced a winner. */
  eliminatedId: number | null;
  /** Set on the final round when a winner is decided. */
  winnerId: number | null;
  /**
   * Present when the elimination involved a tie for last place. Explains which
   * candidates were tied and how the tie was broken:
   *  - 'fewer-first-choice': the eliminated one had the fewest original
   *    first-choice votes among those tied.
   *  - 'fixed': still exactly tied (even on first-choice votes), so a fixed
   *    deterministic rule decided it (keeps results reproducible).
   */
  tie?: {
    tiedIds: number[];
    lowVotes: number;
    reason: 'fewer-first-choice' | 'fixed';
  };
}

export interface RCVResult {
  rounds: RoundResult[];
  winnerId: number | null;
  /** Item ids ordered by finishing position: [1st, 2nd, 3rd, ...]. */
  placements: number[];
  totalBallots: number;
}

/**
 * Sort comparator for "standing" (best first): more votes wins; ties broken by
 * more original first-choice support, then lower id (stable, deterministic).
 */
function standingCmp(
  a: Tally,
  b: Tally,
  originalFirst: Map<number, number>
): number {
  if (b.votes !== a.votes) return b.votes - a.votes;
  const fa = originalFirst.get(a.itemId) ?? 0;
  const fb = originalFirst.get(b.itemId) ?? 0;
  if (fb !== fa) return fb - fa;
  return a.itemId - b.itemId;
}

/**
 * Pick the candidate to eliminate: fewest current votes; ties broken by fewest
 * original first-choice votes, then highest id (deterministic).
 */
function pickLoser(tallies: Tally[], originalFirst: Map<number, number>): number {
  const min = Math.min(...tallies.map((t) => t.votes));
  const candidates = tallies.filter((t) => t.votes === min);
  candidates.sort((a, b) => {
    const fa = originalFirst.get(a.itemId) ?? 0;
    const fb = originalFirst.get(b.itemId) ?? 0;
    if (fa !== fb) return fa - fb; // fewer original first-choice → eliminate first
    return b.itemId - a.itemId; // higher id eliminated first
  });
  return candidates[0].itemId;
}

export function computeRCV(
  itemIds: number[],
  ballots: number[][]
): RCVResult {
  const totalBallots = ballots.length;

  if (itemIds.length === 0 || totalBallots === 0) {
    return { rounds: [], winnerId: null, placements: [], totalBallots };
  }

  const validIds = new Set(itemIds);
  // Normalize ballots: keep only valid ids, drop duplicates, preserve order.
  const cleanBallots = ballots.map((b) => {
    const seen = new Set<number>();
    const out: number[] = [];
    for (const raw of b) {
      const id = Number(raw);
      if (validIds.has(id) && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  });

  // Original first-choice counts (across all candidates) for tiebreaks.
  const originalFirst = new Map<number, number>();
  for (const b of cleanBallots) {
    if (b.length > 0) {
      originalFirst.set(b[0], (originalFirst.get(b[0]) ?? 0) + 1);
    }
  }

  const active = new Set(itemIds);
  const eliminationOrder: number[] = [];
  const rounds: RoundResult[] = [];
  let winnerId: number | null = null;

  // Safety bound: at most itemIds.length rounds.
  while (active.size > 0) {
    const tally = new Map<number, number>();
    for (const id of active) tally.set(id, 0);

    let exhausted = 0;
    for (const b of cleanBallots) {
      const top = b.find((id) => active.has(id));
      if (top === undefined) {
        exhausted++;
      } else {
        tally.set(top, (tally.get(top) ?? 0) + 1);
      }
    }

    const continuing = totalBallots - exhausted;
    const majority = Math.floor(continuing / 2) + 1;
    const tallies: Tally[] = [...tally.entries()]
      .map(([itemId, votes]) => ({ itemId, votes }))
      .sort((a, b) => standingCmp(a, b, originalFirst));

    const roundNum = rounds.length + 1;
    const top = tallies[0];
    const hasMajority = continuing > 0 && top.votes >= majority;

    if (active.size <= 1 || hasMajority) {
      winnerId = top.itemId;
      rounds.push({
        round: roundNum,
        tallies,
        majority,
        continuing,
        exhausted,
        eliminatedId: null,
        winnerId,
      });
      break;
    }

    const loser = pickLoser(tallies, originalFirst);

    // Record tie-break details when more than one candidate shared the lowest tally.
    const lowVotes = Math.min(...tallies.map((t) => t.votes));
    const tiedIds = tallies
      .filter((t) => t.votes === lowVotes)
      .map((t) => t.itemId);
    let tie: RoundResult['tie'];
    if (tiedIds.length > 1) {
      const minFirst = Math.min(
        ...tiedIds.map((id) => originalFirst.get(id) ?? 0)
      );
      const withMinFirst = tiedIds.filter(
        (id) => (originalFirst.get(id) ?? 0) === minFirst
      );
      tie = {
        tiedIds,
        lowVotes,
        reason: withMinFirst.length === 1 ? 'fewer-first-choice' : 'fixed',
      };
    }

    active.delete(loser);
    eliminationOrder.push(loser);
    rounds.push({
      round: roundNum,
      tallies,
      majority,
      continuing,
      exhausted,
      eliminatedId: loser,
      winnerId: null,
      tie,
    });
  }

  // Placements: winner, then any other still-active candidates by final standing,
  // then everyone else in reverse elimination order (last eliminated = higher).
  const finalTallies = rounds.length > 0 ? rounds[rounds.length - 1].tallies : [];
  const remainingActive = finalTallies
    .map((t) => t.itemId)
    .filter((id) => id !== winnerId);
  const placements: number[] = [];
  const pushUnique = (id: number) => {
    if (id !== undefined && !placements.includes(id)) placements.push(id);
  };
  if (winnerId !== null) pushUnique(winnerId);
  remainingActive.forEach(pushUnique);
  [...eliminationOrder].reverse().forEach(pushUnique);

  return { rounds, winnerId, placements, totalBallots };
}
