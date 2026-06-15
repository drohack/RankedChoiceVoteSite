# Salty Chart Vote — Ranked Choice Voting

A small self-hosted ranked-choice (instant-runoff) voting site.

- **Admins** create votings (a title, a master image, and up to ~10 items, each
  with a name + image), then start/stop a vote. While a vote is live the admin
  screen becomes a full-screen presentation: the master image on one side, a
  large QR code + short copy link on the other, plus a live vote count.
- **Voters** open the base URL on their phone, tap items to rank them (at least
  one, not necessarily all), and submit once. A cookie softly limits re-voting.
- **Results** are an animated, manually-advanced walkthrough of each elimination
  round — showing where eliminated ballots transfer (green `+N` badges),
  explaining any tie-breaks in plain language, and ending with a winner
  celebration and a 1st/2nd/3rd podium.

Only one vote runs at a time, so the voter link is just the site root (`/`).

## Tech stack

- Next.js 15 (App Router) + React 19, TypeScript, Tailwind CSS
- SQLite via `better-sqlite3`
- `sharp` (image resize), `qrcode` (QR), `framer-motion` (results animation)
- Vitest (unit + route/middleware integration tests)

## Routes

| Path | Who | Purpose |
|------|-----|---------|
| `/` | Public | Voting page for the open round (or "no vote running") |
| `/results` | Admin | Animated results of the current/most-recent round |
| `/admin` | Admin | List votings, create, start/stop, live link + QR + vote count |
| `/admin/login` | Public | Password login |
| `/admin/voting/new`, `/admin/voting/[id]` | Admin | Create / edit a voting |

API: `POST /api/admin/login`·`/logout`, `GET /api/admin/status`,
`POST /api/admin/upload`, `POST /api/admin/votings`,
`PUT|DELETE /api/admin/votings/[id]`, `POST /api/admin/votings/[id]/start`·`/stop`,
`POST /api/vote`, `GET /uploads/[file]`.

Everything under `/admin`, `/results`, and `/api/admin` is protected by a session
cookie (middleware). `/`, `/api/vote`, and `/uploads/*` are public.

## Environment variables

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `ADMIN_PASSWORD` | prod | `changeme` | Admin login password |
| `SESSION_SECRET` | prod | dev fallback | Signs the admin session cookie (`openssl rand -hex 32`) |
| `DATA_DIR` | no | `./data` | Where `app.db` + `uploads/` live (Docker: `/data`) |
| `VOTE_URL` | no | request origin | Public URL shown on the admin QR/link (runtime; set if admin and voters use different hosts) |

See `.env.example`.

## Local development

```bash
npm install
cp .env.example .env      # set ADMIN_PASSWORD / SESSION_SECRET
npm run dev               # http://localhost:3000
npm test                  # full unit suite (Vitest)
npm run verify            # tests + production build — run before deploying
```

Data (SQLite db + uploaded images) is written to `./data/`, which is gitignored.

## Tests

`npm test` runs the full suite. Unit tests (`lib/*.test.ts`) cover the
ranked-choice algorithm (`rcv`), input validation, session-token signing/
verification, the SQLite data layer + round-lifecycle invariants (`queries`),
the results integration (`results`), and image processing (`images`).
Integration tests (`test/*.test.ts`) invoke the real API route handlers (voting
CRUD, start/stop, status, upload, login/logout/vote) and the auth middleware.
Database tests run against a real in-memory SQLite — no mocks.

This suite is the **deploy gate**: `npm test` runs inside the Docker build, so a
failing test blocks the image from being produced.

## Deploy (Docker / unraid)

The app is a single container with one persistent volume (`/data`). The compose
file maps host **8766 → container 3000**.

```bash
git pull
ADMIN_PASSWORD='…' SESSION_SECRET="$(openssl rand -hex 32)" \
  docker compose up -d --build
```

- Admin at `http://HOST:8766/admin`, voting at `http://HOST:8766/`; put it behind
  a reverse proxy for `https://vote.saltychart.net`.
- On unraid, point the `/data` volume at e.g.
  `/mnt/user/appdata/ranked-choice-vote/data` so the database and uploaded
  images survive rebuilds.
- To update: `git pull` then `docker compose up -d --build` (the test suite runs
  inside the build, so a failing test blocks the deploy).

**See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)** for the full guide: Unraid
(compose, Docker UI, and the `ranked-choice-vote.xml` template), reverse proxy +
SSL, network/port-forwarding, backups, health checks, and troubleshooting.

## How ranked choice works here

Instant-runoff: count each ballot's top still-active choice; if someone has a
majority (more than half of the still-counting ballots) — or only one candidate
remains — they win, otherwise the lowest is eliminated and those ballots transfer
to their next choice. Ballots whose ranked choices are all eliminated become
"exhausted" (so the majority threshold can drop between rounds). Placements use
reverse elimination order (winner = last standing, runner-up = last eliminated,
etc.). See `lib/rcv.ts`.

**Tie-breaks.** If two or more items are tied for last, the one eliminated is the
one with the fewest *original first-choice* votes; if they're still tied even on
first-choice votes, a fixed deterministic rule decides (so the same ballots
always produce the same result). The results page states which rule applied.

**Votes never carry across start/stop/edit.** Each start mints a new *round*;
ballots are tied to a round and the voter's dedupe cookie records which round it
voted in, so a new round automatically resets voting and discards old ballots.
