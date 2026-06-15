# CLAUDE.md — Ranked Choice Vote project notes

Project-specific guidance for working in this repo. Global conventions in
`~/.claude/CLAUDE.md` still apply.

## What this is

Single-container Next.js (App Router) ranked-choice voting site, SQLite-backed,
self-hosted via Docker on unraid. See `README.md` for the full overview.

## Device targets

- `/` (voting page) is **mobile-first** — large tap targets, single column.
- `/admin/*` and `/results` are **desktop-first** — wider layouts, bigger charts.

## Architecture map

- `lib/config.ts` — env-derived config (`DATA_DIR`, `ADMIN_PASSWORD`,
  `SESSION_SECRET`, `VOTED_COOKIE`, `MAX_ITEMS`, `VOTE_URL`). `VOTE_URL` is read
  server-side and passed to `LivePanel` as a prop so it works at runtime in a
  pre-built image (don't use a `NEXT_PUBLIC_*` var — those inline at build time).
- `lib/types.ts` — shared row/DTO interfaces (`Voting`, `Item`, `Round`, `Ballot`).
- `lib/db.ts` — opens SQLite, creates schema on first use. Tables: `votings`,
  `items`, `rounds`, `ballots`. Test helpers: `__setTestDbToMemory`, `__closeDb`.
- `lib/queries.ts` — all DB access (typed helpers). Don't write SQL elsewhere.
- `lib/session.ts` — Web Crypto HMAC session token (works in Edge middleware
  **and** Node route handlers — no Node-only imports here).
- `lib/auth.ts` — password check + session cookie set/clear (Node, uses
  `next/headers` cookies).
- `lib/images.ts` — validate + `sharp`-resize uploads to webp under `DATA_DIR/uploads`.
- `lib/validation.ts` — `parseVotingInput` for the voting CRUD payload.
- `lib/rcv.ts` — pure instant-runoff tabulation (+ `lib/rcv.test.ts`).
- `lib/results.ts` — joins the latest round's ballots + items through `computeRCV`.
- `middleware.ts` — guards `/admin/*`, `/results`, `/api/admin/*`.
- `app/uploads/[file]/route.ts` — serves images from `DATA_DIR` (path-traversal safe).
- Key client components: `app/admin/LivePanel.tsx` (full-screen live QR/master-image
  presentation, polls `/api/admin/status`), `app/admin/voting/VotingEditor.tsx`
  (create/edit form + uploads), `app/results/ResultsView.tsx` (staged animation,
  per-count bar sizing, transfer `+N` badges, tie-break captions, podium),
  `app/VotingForm.tsx` (mobile tap-to-rank).

## Core invariants

- **One open round at a time.** `startRound` closes any other open round first.
- **Votes never persist across start/stop/edit.** Ballots reference `round_id`;
  start mints a new round; editing a voting calls `closeOpenRoundsForVoting`; the
  voter dedupe cookie stores the round id it voted in.
- **Route handler files may only export HTTP methods + route config.** Put shared
  constants in `lib/` (e.g. `VOTED_COOKIE` lives in `lib/config.ts`), never export
  them from a `route.ts` — it breaks `next build` type-checking.
- **Elimination tie-break** (`pickLoser` in `lib/rcv.ts`): lowest current tally →
  fewest original first-choice votes → highest id (deterministic). Each round's
  `RoundResult.tie` records the tied ids + reason (`'fewer-first-choice'` |
  `'fixed'`) so the results page can explain it. The winner needs a majority of
  *continuing* (non-exhausted) ballots, so the threshold can fall between rounds.

## Conventions

- All DB access goes through `lib/queries.ts`. Native modules (`better-sqlite3`,
  `sharp`) are in `serverExternalPackages` (next.config.js) — keep them server-side.
- API routes set `export const runtime = 'nodejs'` (SQLite/sharp need Node).
- Pages that read live DB state set `export const dynamic = 'force-dynamic'`.

## Testing / verification

- `npm test` — the full unit suite (Vitest). **This is the deploy gate** — it
  runs inside the Docker build (`RUN npm test` in the Dockerfile builder), so a
  failing test blocks the image. Run it before every deploy.
- `npm run verify` — `vitest run && next build` (tests + type-check). Run locally
  before pushing.
- Unit tests live next to the code in `lib/*.test.ts`:
  - `rcv.test.ts` — the instant-runoff algorithm (majority, eliminations,
    exhausted ballots, all tie-break paths, placements).
  - `validation.test.ts` — `parseVotingInput`.
  - `session.test.ts` — session token sign/verify, expiry, tampering, secret.
  - `queries.test.ts` — DB layer + round-lifecycle invariants.
  - `results.test.ts` — `buildResults` integration (DB → RCV → payload).
  - `images.test.ts` — `sharp` resize + type rejection.
- Integration tests live in `test/*.test.ts` and exercise the real handlers:
  - `routes-admin.test.ts` — voting CRUD, start/stop, status, upload route
    handlers (called directly, real in-memory DB).
  - `routes-auth.test.ts` — login/logout/vote handlers. Only the cookie jar
    (`next/headers`) is mocked; the DB stays real.
  - `middleware.test.ts` — the auth gate (redirect / 401 / pass-through).
- **DB/storage tests use a REAL in-memory SQLite, never mocks** (per global
  rules). `lib/db.ts` exposes `__setTestDbToMemory()` / `__closeDb()` for this;
  call `__setTestDbToMemory()` in `beforeEach`. `test/setup.ts` points `DATA_DIR`
  at a throwaway temp dir so tests never touch the real `./data`.
- Route handlers are imported and invoked directly with a `Request` (and
  `{ params: Promise.resolve({...}) }` for dynamic segments); assert on the
  returned `Response` status/json. `vitest.config.ts` maps the `@/` alias.
- When you change a `lib/*` module, add/adjust its `*.test.ts` in the same change.
- Manual: `npm run dev`, drive with Playwright at mobile (≈390px) for `/` and
  desktop (≈1280px) for `/admin` + `/results`. To seed ballots for results, start
  a round then insert rows into `ballots` (`ranking_json` = JSON array of item ids).
- **Never commit screenshots or test images** (`*.png`/`*.jpg` are gitignored).
  Playwright file uploads must come from inside the project root (its sandbox);
  delete them right after.

## Deploy

`git pull` → `docker compose up -d --build`. The build runs `npm test` first, so
a broken test fails the deploy. Volume `/data` holds `app.db` + `uploads/`.
Host port **8766 → 3000**. Required env: `ADMIN_PASSWORD`, `SESSION_SECRET`
(optional `VOTE_URL`). Full guide (Unraid compose/UI/XML template, reverse proxy
+ SSL, backups, health checks, troubleshooting) is in `DEPLOYMENT_GUIDE.md`;
the Unraid template is `ranked-choice-vote.xml`.
