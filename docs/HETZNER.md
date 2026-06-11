# Scriber Hetzner Personal Runtime

This setup runs Scriber as an always-on personal tool instead of a localhost demo.

## Shape

- `web`: Next.js dashboard, password gate, meeting bot APIs, Google Calendar OAuth.
- `bridge`: OpenAI Realtime WebSocket bridge for live meeting bots.
- `worker`: polls scheduled bots and launches `meet-runtime` or `zoom-runtime`.
- `caddy`: HTTPS reverse proxy for `www.usescriber.com`.
- `scriber-data`: Docker volume for personal MVP persistence.

## Server

Use a Hetzner Cloud VM with the Docker CE image or install Docker Compose on Ubuntu.

Minimum practical starting point:

- 2 vCPU / 4 GB RAM for web + bridge + one bot runtime.
- 4 vCPU / 8 GB RAM if running Chromium-based Meet bots regularly.

## DNS

Point the domain you want to use at the Hetzner server:

```text
A www.usescriber.com <server-ip>
A usescriber.com <server-ip>
```

Set `SCRIBER_DOMAIN` in `deploy/hetzner/.env` to the host Caddy should serve.

## Google OAuth

Create a Google OAuth web client and add:

```text
https://www.usescriber.com/api/calendar/google/callback
```

Required env:

```text
GOOGLE_CALENDAR_CLIENT_ID=
GOOGLE_CALENDAR_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=https://www.usescriber.com/api/calendar/google/callback
```

Requested scopes:

```text
https://www.googleapis.com/auth/calendar.events.readonly
https://www.googleapis.com/auth/userinfo.email
```

## Deploy

For a clean server where Scriber owns HTTPS:

```bash
cp deploy/hetzner/.env.example deploy/hetzner/.env
$EDITOR deploy/hetzner/.env
docker compose -f deploy/hetzner/docker-compose.yml up -d --build
docker compose -f deploy/hetzner/docker-compose.yml logs -f web bridge worker
```

For an existing server that already runs Caddy or another reverse proxy, do not start Scriber-managed Caddy. Bind Scriber web to localhost and add the proxy route yourself:

```bash
docker compose \
  -f deploy/hetzner/docker-compose.yml \
  -f deploy/hetzner/docker-compose.existing-caddy.yml \
  up -d --build web bridge worker
```

Existing Caddy route:

```caddyfile
app.usescriber.com {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

Then open the host you routed:

```text
https://app.usescriber.com/meetings
```

Use the password from `SCRIBER_ACCESS_PASSWORD`, connect Google Calendar, and press Sync. Accepted future Zoom/Google Meet events are imported and scheduled two minutes before start.

## Runtime Notes

Google Meet uses Playwright Chromium and Linux audio commands. The current runtime boundary is present, but a production Meet bot still needs hardened virtual audio setup, a persistent logged-in Google profile, and staging tests against real meetings.

Zoom support currently has the SDK process boundary and bridge contract. A native Zoom Meeting SDK/raw-data implementation is still required before real Zoom joins work.

## Useful Commands

```bash
docker compose -f deploy/hetzner/docker-compose.yml ps
docker compose -f deploy/hetzner/docker-compose.yml logs -f worker
docker compose -f deploy/hetzner/docker-compose.yml restart worker bridge
docker compose -f deploy/hetzner/docker-compose.yml exec web ls -la /data
```
