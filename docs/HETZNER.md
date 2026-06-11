# Scriber Dedicated Hetzner Runtime

This runbook is for a new, isolated Scriber backend host. Existing production boxes stay off-limits.

## Decision

Use a fresh Hetzner Cloud server named `scriber-hil` for the internal MVP.

Recommended start:

```text
server_type: cpx41
location: hil
image: ubuntu-24.04
resources: 8 shared vCPU, 16 GB RAM, 240 GB disk
current API price: 46.49 USD/month, 0.0745 USD/hour
```

Rationale: Google Meet bots run Chromium, audio capture/playback, screenshots, and Realtime streaming. RAM headroom matters more than perfect CPU isolation for the first handful of concurrent meetings. `cpx41` gives enough memory and disk without starting on a dedicated-vCPU bill.

Dedicated-vCPU alternative:

```text
ccx23: 4 dedicated vCPU, 16 GB RAM, 160 GB disk, 39.99 USD/month in hil
ccx33: 8 dedicated vCPU, 32 GB RAM, 240 GB disk, 76.99 USD/month in hil
```

Use `ccx23` if Chromium CPU jitter becomes the bottleneck before memory does. Use `ccx33` when this becomes a paid service or needs several simultaneous active bots with lower latency variance.

## Topology

- Host Caddy terminates TLS for `app.usescriber.com`.
- Docker Compose runs:
  - `web`: Next.js dashboard/API/password gate.
  - `bridge`: OpenAI Realtime WebSocket bridge.
  - `worker`: scheduler that launches due bots.
  - per-meeting runtimes launched by the worker.
- Named Docker volume `scriber-data` stores MVP state and Google profile data.
- `www.usescriber.com` stays on Vercel and is not touched by this deployment.

## Security

Cloud-init configures:

- User `elias` with `~/.ssh/id_ed25519.pub`.
- Password SSH disabled.
- Tailscale joined as `scriber-hil`.
- UFW default deny incoming.
- Public `80/tcp` and `443/tcp` only.
- Tailscale interface allowed for SSH/private admin.
- 8 GB swapfile for Chromium spike safety.

## Provisioning Gate

Do not create the server until the plan and monthly cost are approved.

Dry-run:

```bash
bash deploy/hetzner/provision-scriber-hil.sh --dry-run
```

Paid create command, after approval:

```bash
bash deploy/hetzner/provision-scriber-hil.sh --execute
```

The script reads these secrets from 1Password without printing them:

- `Hetzner Elias API` in vault `Clawdbot`
- `Tailscale Gateway Token Mac Mini` in vault `Clawdbot`

It registers the local `~/.ssh/id_ed25519.pub` in the Hetzner project if needed, injects it into cloud-init, and creates `scriber-hil`.

## DNS

After the server exists and the public IPv4 is known, set only:

```text
A app.usescriber.com <new-server-ip>
```

Do not change:

```text
www.usescriber.com
usescriber.com
```

## First Deploy

On the new host:

```bash
sudo mkdir -p /opt/scriber
sudo chown -R elias:elias /opt/scriber
cd /opt/scriber
git clone https://github.com/benikigai/scriber.git .
cp deploy/hetzner/.env.example deploy/hetzner/.env
$EDITOR deploy/hetzner/.env
sudo cp deploy/hetzner/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
docker compose -f deploy/hetzner/docker-compose.yml up -d --build
docker compose -f deploy/hetzner/docker-compose.yml logs -f web bridge worker
```

Open:

```text
https://app.usescriber.com/meetings
```

Use the password from `SCRIBER_ACCESS_PASSWORD`, connect Google Calendar, and press Sync. Accepted future Zoom/Google Meet events are imported and scheduled two minutes before start.

## Runtime Notes

Google Meet uses Playwright Chromium and Linux audio commands. The runtime boundary exists, but production-grade Meet bots still need hardened virtual audio setup, a persistent logged-in Google profile, and staging tests against real meetings.

Zoom support currently has the SDK process boundary and bridge contract. A native Zoom Meeting SDK/raw-data implementation is still required before real Zoom joins work.

## Future Scale Path

When this becomes a small paid service:

1. Move from `cpx41` to `ccx33` or a larger dedicated-vCPU type.
2. Externalize state from JSON/Docker volume to Postgres plus object storage.
3. Split runtime workers from the web/API host.
4. Add a second worker host before adding multi-tenant product logic.
5. Add queueing, per-meeting resource limits, and billing/account boundaries.
