# Scriber Dedicated Hetzner Runtime

This runbook is for a new, isolated Scriber backend host. Existing production boxes stay off-limits.

## Decision

Use a fresh Hetzner Cloud server named `scriber-hel` for the internal MVP.

Current host:

```text
server id: 139807416
server name: scriber-hel
server type: cx43
location: hel1
public IPv4: 89.167.70.60
public IPv6: 2a01:4f9:c014:7a3a::/64
image: ubuntu-24.04
resources: 8 shared vCPU, 16 GB RAM, 160 GB disk
API price at provision: 13.99 USD/month, 0.0224 USD/hour
Docker volume: hetzner_scriber-data
```

Rationale: Google Meet bots run Chromium, audio capture/playback, screenshots, and Realtime streaming. RAM headroom matters more than perfect CPU isolation for the first handful of concurrent meetings. `cx43` gives enough memory and disk without starting on a dedicated-vCPU bill.

Dedicated-vCPU alternative:

```text
ccx23: 4 dedicated vCPU, 16 GB RAM, 160 GB disk, 36.99 USD/month in hel1
ccx33: 8 dedicated vCPU, 32 GB RAM, 240 GB disk, 73.99 USD/month in hel1
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
- Tailscale joined as `scriber-hel`.
- UFW default deny incoming.
- Public `80/tcp` and `443/tcp` only.
- Tailscale interface allowed for SSH/private admin.
- 8 GB swapfile for Chromium spike safety.

If Tailscale auth fails during bootstrap, cloud-init leaves temporary public SSH open and writes `/var/log/scriber-tailscale-auth.failed` so the host can be repaired. After joining the tailnet, remove public SSH from UFW and administer over Tailscale.

Current status: the server is provisioned and live, but the stored 1Password item `Tailscale Gateway Token Mac Mini` was rejected by Tailscale during bootstrap. Public SSH is temporarily open, key-only, until the server joins Tailscale. Generate a fresh reusable/pre-authorized Tailscale auth key, update that 1Password item, then run:

```bash
ssh elias@89.167.70.60
sudo tailscale up --authkey=<fresh-auth-key> --hostname=scriber-hel --ssh
sudo ufw allow in on tailscale0
sudo ufw delete allow OpenSSH || true
tailscale status
```

## Provisioning Gate

This server has already been created after approval. Keep the provisioning script for rebuilds or replacement hosts.

Dry-run:

```bash
bash deploy/hetzner/provision-scriber-hel.sh --dry-run
```

Paid create command, after approval:

```bash
bash deploy/hetzner/provision-scriber-hel.sh --execute
```

The script reads these secrets from 1Password without printing them:

- `Hetzner Elias API` in vault `Clawdbot`
- `Tailscale Gateway Token Mac Mini` in vault `Clawdbot`

It registers the local `~/.ssh/id_ed25519.pub` in the Hetzner project if needed, injects it into cloud-init, and creates `scriber-hel`.

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
sudo docker compose -f deploy/hetzner/docker-compose.yml up -d --build
sudo docker compose -f deploy/hetzner/docker-compose.yml logs -f web bridge worker
```

Open:

```text
https://app.usescriber.com/meetings
```

Use the password from `SCRIBER_ACCESS_PASSWORD`, connect Google Calendar, and press Sync. Accepted future Zoom/Google Meet events are imported and scheduled two minutes before start.

Google OAuth callback:

```text
https://app.usescriber.com/api/calendar/google/callback
```

If Google returns `redirect_uri_mismatch`, add that callback to the OAuth client used by `GOOGLE_CALENDAR_CLIENT_ID`.

## Runtime Notes

Google Meet uses Playwright Chromium and Linux audio commands. The runtime boundary exists, but production-grade Meet bots still need hardened virtual audio setup, a persistent logged-in Google profile, and staging tests against real meetings.

Zoom support currently has the SDK process boundary and bridge contract. A native Zoom Meeting SDK/raw-data implementation is still required before real Zoom joins work.

## Future Scale Path

When this becomes a small paid service:

1. Move from `cx43` to `cpx42`, `ccx23`, `ccx33`, or a larger dedicated-vCPU type.
2. Externalize state from JSON/Docker volume to Postgres plus object storage.
3. Split runtime workers from the web/API host.
4. Add a second worker host before adding multi-tenant product logic.
5. Add queueing, per-meeting resource limits, and billing/account boundaries.
