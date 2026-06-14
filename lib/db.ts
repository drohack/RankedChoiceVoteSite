import Database from 'better-sqlite3';
import fs from 'node:fs';
import { DB_PATH, DATA_DIR, UPLOADS_DIR } from './config';

let db: Database.Database | null = null;

/** Create the schema on a freshly opened database. */
function applySchema(database: Database.Database): void {
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE IF NOT EXISTS votings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      master_image TEXT,
      created_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      voting_id  INTEGER NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      image      TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- A round is a single "voting block". Starting a vote mints a new round;
    -- stopping closes it; editing the voting invalidates any open round.
    -- Ballots are tied to a round, so votes never carry across start/stop/edit.
    CREATE TABLE IF NOT EXISTS rounds (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      voting_id  INTEGER NOT NULL REFERENCES votings(id) ON DELETE CASCADE,
      status     TEXT NOT NULL CHECK (status IN ('open','closed')),
      started_at INTEGER NOT NULL,
      ended_at   INTEGER
    );

    CREATE TABLE IF NOT EXISTS ballots (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id     INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      ranking_json TEXT NOT NULL,
      created_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_voting ON items(voting_id);
    CREATE INDEX IF NOT EXISTS idx_rounds_voting ON rounds(voting_id);
    CREATE INDEX IF NOT EXISTS idx_ballots_round ON ballots(round_id);
  `);
}

function init(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const database = new Database(DB_PATH);
  database.pragma('journal_mode = WAL');
  applySchema(database);
  return database;
}

export function getDb(): Database.Database {
  if (!db) {
    db = init();
  }
  return db;
}

/**
 * Test helper: replace the singleton with a fresh in-memory database so tests
 * run against a real SQLite instance (no mocks) in full isolation. Call in
 * beforeEach. Never used by the app at runtime.
 */
export function __setTestDbToMemory(): Database.Database {
  if (db) db.close();
  db = new Database(':memory:');
  applySchema(db);
  return db;
}

/** Test helper: close and clear the singleton. Call in afterAll. */
export function __closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
