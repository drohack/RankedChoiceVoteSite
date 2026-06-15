# Ranked Choice Vote — Deployment Guide

Single-container Next.js app (port **3000**) with one persistent volume
(**`/data`** — holds the SQLite database and uploaded images). Image is built
from the included `Dockerfile`; `npm test` runs inside the build, so a failing
test blocks the image.

---

## Quick Deployment (Docker Compose)

```bash
# 1. Set the required secrets (or put them in a .env file next to compose)
export ADMIN_PASSWORD='choose-a-strong-password'
export SESSION_SECRET="$(openssl rand -hex 32)"

# 2. Build + start
docker compose up -d --build

# 3. Access
#    Admin:  http://localhost:8766/admin
#    Voting: http://localhost:8766/

# Logs / stop
docker compose logs -f
docker compose down
```

The compose file maps host **8766 → container 3000**; change the host port to
taste or to fit behind your reverse proxy.

---

## Unraid Deployment

### Method A: Docker Compose on Unraid

1. **Copy the project to Unraid** (or `git clone` directly on the box):
   ```bash
   scp -r RankedChoiceVote root@UNRAID-IP:/mnt/user/appdata/
   ```
2. **SSH in and start it**:
   ```bash
   ssh root@UNRAID-IP
   cd /mnt/user/appdata/RankedChoiceVote
   export ADMIN_PASSWORD='...' SESSION_SECRET="$(openssl rand -hex 32)"
   docker compose up -d --build
   ```
   The `./data` bind in the compose file persists the DB + uploads under the
   project folder. To use the standard appdata location instead, point the
   volume at `/mnt/user/appdata/ranked-choice-vote/data`.

### Method B: Unraid Docker UI

1. **Build the image** (on the box or your PC, then push to a registry):
   ```bash
   docker build -t ranked-choice-vote .
   ```
2. **Create the data directory**:
   ```bash
   mkdir -p /mnt/user/appdata/ranked-choice-vote/data
   ```
3. **Add a container** in the Unraid Docker UI:
   - **Name**: `ranked-choice-vote`
   - **Repository**: `ranked-choice-vote` (or your registry image)
   - **Network Type**: bridge
   - **Port**: `3000` (container) → `8766` (host)
   - **Path**: `/mnt/user/appdata/ranked-choice-vote/data` → `/data`
   - **Variable**: `ADMIN_PASSWORD` → your password
   - **Variable**: `SESSION_SECRET` → a long random string (`openssl rand -hex 32`)
   - **Variable** (optional): `VOTE_URL` → `https://vote.saltychart.net`
   - **Auto-start**: Yes
4. **Apply / Start.**

### Unraid Template (XML)

A ready-made template is included as **`ranked-choice-vote.xml`** — drop it in
`/boot/config/plugins/dockerMan/templates-user/` on Unraid (or paste its values
into the Docker UI). Update the `Repository` / `Support` / `Project` fields to
your registry + repo.

---

## Local Development

```bash
npm install
cp .env.example .env     # set ADMIN_PASSWORD / SESSION_SECRET
npm run dev              # http://localhost:3000
npm run verify           # tests + production build — run before deploying
```

Data is written to `./data/` (gitignored).

---

## Network Configuration

### Local network access (QR voting)

Voters scan the QR (or open the link) on the same network:

1. Find the server IP — `ip addr` (Linux) / `ipconfig` (Windows).
2. Voters open `http://SERVER-IP:8766/`.

The admin "live" panel builds the QR from its own browser origin, or from the
`VOTE_URL` env var if set (see below) — set `VOTE_URL` when the admin and voters
reach the site by different hostnames.

### External access (behind a router)

1. **Port forward** on the router: external port → internal `SERVER-IP:8766` (TCP).
2. **Dynamic DNS** (DuckDNS / No-IP) if your public IP changes.
3. Open the firewall port if needed: `sudo ufw allow 8766/tcp`.

### Reverse proxy (recommended for `vote.saltychart.net`)

The app is plain HTTP with no WebSockets, so a standard proxy works.

**Nginx** — `/etc/nginx/sites-available/vote`:
```nginx
server {
    listen 80;
    server_name vote.saltychart.net;

    client_max_body_size 20M;   # allow image uploads

    location / {
        proxy_pass http://localhost:8766;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/vote /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
# Add HTTPS:
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d vote.saltychart.net
```
With TLS terminated at the proxy on the real domain, set
`VOTE_URL=https://vote.saltychart.net` so the QR/link always shows the public
URL.

**Traefik (Docker labels)** — add to the `vote` service in `docker-compose.yml`:
```yaml
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.vote.rule=Host(`vote.saltychart.net`)"
      - "traefik.http.routers.vote.entrypoints=websecure"
      - "traefik.http.routers.vote.tls.certresolver=letsencrypt"
      - "traefik.http.services.vote.loadbalancer.server.port=3000"
```

---

## Environment Variables

| Var | Required | Default | Notes |
|-----|----------|---------|-------|
| `ADMIN_PASSWORD` | **prod** | `changeme` | Admin login password |
| `SESSION_SECRET` | **prod** | dev fallback | Signs the admin session cookie — `openssl rand -hex 32` |
| `VOTE_URL` | no | request origin | Public URL on the QR/link (runtime; set if admin/voters use different hosts) |
| `DATA_DIR` | no | `/data` (Docker) | Where `app.db` + `uploads/` live |

Set them via compose `environment:`, `docker run -e`, the Unraid UI, or a `.env`
file (see `.env.example`).

---

## Data Persistence & Backup

Everything lives in the `/data` volume: `app.db` (SQLite) and `uploads/`
(resized webp images). It persists across container restarts and rebuilds.

```bash
# Back up the whole data dir
tar -czf rcv_backup_$(date +%Y%m%d).tar.gz data/

# Reset everything (wipes votings, rounds, images)
docker compose down
rm -rf data/*
docker compose up -d
```

Note: by design, **votes never persist across start/stop/edit of a voting** —
each start mints a fresh round. Backups are for the voting *configurations* and
uploaded images, not in-progress ballots.

---

## Monitoring & Logs

```bash
docker compose logs -f                 # follow logs
docker compose logs -f --tail=100
docker ps                              # STATUS shows healthy/unhealthy
curl -I http://localhost:8766/         # manual check (expect 200)
```

The container ships a health check (HTTP GET `/`); compose and the Dockerfile
both define it, so Unraid shows health status either way.

---

## Updating

Data persists in `/data`, and the app has **no DB migrations** to worry about,
so updates are just a pull + rebuild:

```bash
cd /mnt/user/appdata/RankedChoiceVote      # or wherever it lives
docker compose down
git pull origin main
docker compose up -d --build               # runs the test suite, then builds
docker compose logs -f                      # watch it come up
```

If the build fails on tests, the old container keeps running — fix the issue and
rebuild. To roll back: `git checkout <previous-commit>` then rebuild.

---

## Troubleshooting

**Container won't start / build fails**
```bash
docker compose logs
docker compose build --no-cache            # clean rebuild
```
A build that fails during `npm test` means a test is red — the image is
intentionally not produced. Run `npm test` locally to see which.

**Can't reach it from other devices**
- Confirm the port is published: `docker ps` (look for `0.0.0.0:8766->3000`).
- `curl http://localhost:8766/` on the host; check the firewall; same network.

**QR code points at the wrong URL**
- Set `VOTE_URL` to the public address and recreate the container.

**Uploads fail / images missing**
- Ensure the `/data` volume is writable by the container and has free space;
  uploads land in `/data/uploads`.

**Start a vote.** Admin → create a voting (≥2 items) → **Start**. The live panel
shows the QR + link. Stop, then open **Results** to walk through the rounds.

---

## Unraid auto-start

In the container's Docker settings set **Autostart: Yes** (and a Start Order if
you sequence containers). The compose file already sets `restart: unless-stopped`.
