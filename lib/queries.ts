import { getDb } from './db';
import type { Voting, Item, Round, Ballot, VotingWithItems } from './types';

// ---- Votings -------------------------------------------------------------

export function listVotings(): Voting[] {
  return getDb()
    .prepare('SELECT * FROM votings ORDER BY created_at DESC')
    .all() as Voting[];
}

export function getVoting(id: number): Voting | undefined {
  return getDb().prepare('SELECT * FROM votings WHERE id = ?').get(id) as
    | Voting
    | undefined;
}

export function getVotingWithItems(id: number): VotingWithItems | undefined {
  const voting = getVoting(id);
  if (!voting) return undefined;
  return { ...voting, items: getItems(id) };
}

export function createVoting(title: string, masterImage: string | null): number {
  const info = getDb()
    .prepare(
      'INSERT INTO votings (title, master_image, created_at) VALUES (?, ?, ?)'
    )
    .run(title, masterImage, Date.now());
  return Number(info.lastInsertRowid);
}

export function updateVoting(
  id: number,
  title: string,
  masterImage: string | null
): void {
  getDb()
    .prepare('UPDATE votings SET title = ?, master_image = ? WHERE id = ?')
    .run(title, masterImage, id);
}

export function deleteVoting(id: number): void {
  getDb().prepare('DELETE FROM votings WHERE id = ?').run(id);
}

// ---- Items ---------------------------------------------------------------

export function getItems(votingId: number): Item[] {
  return getDb()
    .prepare(
      'SELECT * FROM items WHERE voting_id = ? ORDER BY sort_order ASC, id ASC'
    )
    .all(votingId) as Item[];
}

/** Replace all items for a voting in a single transaction. */
export function replaceItems(
  votingId: number,
  items: { name: string; image: string | null }[]
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM items WHERE voting_id = ?').run(votingId);
    const insert = db.prepare(
      'INSERT INTO items (voting_id, name, image, sort_order) VALUES (?, ?, ?, ?)'
    );
    items.forEach((item, idx) => {
      insert.run(votingId, item.name, item.image, idx);
    });
  });
  tx();
}

// ---- Rounds (voting blocks) ---------------------------------------------

/** The single open round across the whole system, if any. */
export function getOpenRound(): Round | undefined {
  return getDb()
    .prepare("SELECT * FROM rounds WHERE status = 'open' ORDER BY id DESC LIMIT 1")
    .get() as Round | undefined;
}

export function getRound(id: number): Round | undefined {
  return getDb().prepare('SELECT * FROM rounds WHERE id = ?').get(id) as
    | Round
    | undefined;
}

/** Most recent round (open or closed) for a voting — used by the results page. */
export function getLatestRound(votingId: number): Round | undefined {
  return getDb()
    .prepare('SELECT * FROM rounds WHERE voting_id = ? ORDER BY id DESC LIMIT 1')
    .get(votingId) as Round | undefined;
}

/** The most recent round across all votings (open or closed). */
export function getLatestRoundAny(): Round | undefined {
  return getDb()
    .prepare('SELECT * FROM rounds ORDER BY id DESC LIMIT 1')
    .get() as Round | undefined;
}

/** Close any open round, then open a fresh one for this voting. */
export function startRound(votingId: number): number {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE rounds SET status = 'closed', ended_at = ? WHERE status = 'open'"
    ).run(Date.now());
    const info = db
      .prepare(
        "INSERT INTO rounds (voting_id, status, started_at) VALUES (?, 'open', ?)"
      )
      .run(votingId, Date.now());
    return Number(info.lastInsertRowid);
  });
  return tx();
}

export function stopRound(roundId: number): void {
  getDb()
    .prepare(
      "UPDATE rounds SET status = 'closed', ended_at = ? WHERE id = ? AND status = 'open'"
    )
    .run(Date.now(), roundId);
}

/** Close any open round for a voting (used when editing invalidates a block). */
export function closeOpenRoundsForVoting(votingId: number): void {
  getDb()
    .prepare(
      "UPDATE rounds SET status = 'closed', ended_at = ? WHERE voting_id = ? AND status = 'open'"
    )
    .run(Date.now(), votingId);
}

// ---- Ballots -------------------------------------------------------------

export function insertBallot(roundId: number, ranking: number[]): void {
  getDb()
    .prepare(
      'INSERT INTO ballots (round_id, ranking_json, created_at) VALUES (?, ?, ?)'
    )
    .run(roundId, JSON.stringify(ranking), Date.now());
}

export function getBallots(roundId: number): Ballot[] {
  return getDb()
    .prepare('SELECT * FROM ballots WHERE round_id = ? ORDER BY id ASC')
    .all(roundId) as Ballot[];
}

export function countBallots(roundId: number): number {
  const row = getDb()
    .prepare('SELECT COUNT(*) AS c FROM ballots WHERE round_id = ?')
    .get(roundId) as { c: number };
  return row.c;
}
