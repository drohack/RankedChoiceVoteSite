import path from 'node:path';

/**
 * Resolved runtime configuration. In Docker, DATA_DIR is set to /data (a mounted
 * volume). Locally it defaults to ./data inside the project (gitignored).
 */
export const DATA_DIR =
  process.env.DATA_DIR && process.env.DATA_DIR.trim().length > 0
    ? process.env.DATA_DIR
    : path.join(process.cwd(), 'data');

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'app.db');

export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme';

/**
 * Secret used to sign the admin session cookie. MUST be overridden in production
 * via the SESSION_SECRET env var. The fallback is only for local development.
 */
export const SESSION_SECRET =
  process.env.SESSION_SECRET ?? 'dev-insecure-session-secret-change-me';

export const MAX_ITEMS = 20; // soft cap; typical use is ~10

/**
 * Optional public voting URL shown on the admin QR code + copy link. Read at
 * runtime (server-side) and passed to the client, so it works in a pre-built
 * Docker image without a rebuild. If empty, the admin page falls back to its
 * own browser origin.
 */
export const VOTE_URL = process.env.VOTE_URL ?? '';

/** Cookie that records which round this browser already voted in (soft dedupe). */
export const VOTED_COOKIE = 'voted_round';
