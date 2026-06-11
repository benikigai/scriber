#!/usr/bin/env bash
set -euo pipefail

EXECUTE=false
if [[ "${1:-}" == "--execute" ]]; then
  EXECUTE=true
elif [[ "${1:-}" != "" && "${1:-}" != "--dry-run" ]]; then
  echo "Usage: $0 [--dry-run|--execute]" >&2
  exit 2
fi

SERVER_NAME="${SERVER_NAME:-scriber-hil}"
SERVER_TYPE="${SERVER_TYPE:-cpx41}"
LOCATION="${LOCATION:-hil}"
IMAGE="${IMAGE:-ubuntu-24.04}"
PUBLIC_KEY_FILE="${PUBLIC_KEY_FILE:-$HOME/.ssh/id_ed25519.pub}"
SSH_KEY_NAME="${SSH_KEY_NAME:-scriber-mbp-m4-pro-max}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLOUD_INIT_TEMPLATE="$ROOT_DIR/deploy/hetzner/cloud-init.scriber.yml"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require curl
require jq
require op
require python3
require ssh-keygen

if [[ ! -f "$PUBLIC_KEY_FILE" ]]; then
  echo "Public key not found: $PUBLIC_KEY_FILE" >&2
  exit 1
fi

HETZNER_TOKEN="$(op item get "Hetzner Elias API" --vault Clawdbot --fields notesPlain --reveal)"
TAILSCALE_AUTHKEY="$(op item get "Tailscale Gateway Token Mac Mini" --vault Clawdbot --fields notesPlain --reveal)"
SSH_PUBLIC_KEY="$(cat "$PUBLIC_KEY_FILE")"
SSH_FINGERPRINT="$(ssh-keygen -E md5 -lf "$PUBLIC_KEY_FILE" | awk '{sub(/^MD5:/, "", $2); print $2}')"

api() {
  curl -fsS -H "Authorization: Bearer $HETZNER_TOKEN" "$@"
}

SERVER_COUNT="$(api "https://api.hetzner.cloud/v1/servers?name=$SERVER_NAME" | jq '.servers | length')"
if [[ "$SERVER_COUNT" != "0" ]]; then
  echo "A Hetzner server named $SERVER_NAME already exists. Stop." >&2
  exit 1
fi

SSH_KEY_ID="$(api https://api.hetzner.cloud/v1/ssh_keys | jq -r --arg fp "$SSH_FINGERPRINT" '.ssh_keys[]? | select(.fingerprint == $fp) | .id' | head -1)"
if [[ -z "$SSH_KEY_ID" && "$EXECUTE" == true ]]; then
  SSH_KEY_ID="$(
    curl -fsS -X POST \
      -H "Authorization: Bearer $HETZNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg name "$SSH_KEY_NAME" --arg public_key "$SSH_PUBLIC_KEY" '{name:$name, public_key:$public_key}')" \
      https://api.hetzner.cloud/v1/ssh_keys | jq -r '.ssh_key.id'
  )"
fi

USER_DATA="$(
  SSH_PUBLIC_KEY="$SSH_PUBLIC_KEY" TAILSCALE_AUTHKEY="$TAILSCALE_AUTHKEY" CLOUD_INIT_TEMPLATE="$CLOUD_INIT_TEMPLATE" \
    python3 - <<'PY'
import os
from pathlib import Path

template = Path(os.environ["CLOUD_INIT_TEMPLATE"]).read_text()
template = template.replace("__SSH_PUBLIC_KEY__", os.environ["SSH_PUBLIC_KEY"])
template = template.replace("__TAILSCALE_AUTHKEY__", os.environ["TAILSCALE_AUTHKEY"])
print(template, end="")
PY
)"

if [[ -n "$SSH_KEY_ID" ]]; then
  SSH_KEYS_JSON="$(jq -n --argjson id "$SSH_KEY_ID" '[$id]')"
else
  SSH_KEYS_JSON="[]"
fi

CREATE_PAYLOAD="$(
  jq -n \
    --arg name "$SERVER_NAME" \
    --arg server_type "$SERVER_TYPE" \
    --arg image "$IMAGE" \
    --arg location "$LOCATION" \
    --arg user_data "$USER_DATA" \
    --argjson ssh_keys "$SSH_KEYS_JSON" \
    '{
      name: $name,
      server_type: $server_type,
      image: $image,
      location: $location,
      ssh_keys: $ssh_keys,
      user_data: $user_data,
      public_net: {enable_ipv4: true, enable_ipv6: true},
      labels: {app: "scriber", environment: "mvp", owner: "benikigai"}
    }'
)"

PRICE_ROW="$(api https://api.hetzner.cloud/v1/pricing | jq -r --arg st "$SERVER_TYPE" --arg loc "$LOCATION" '.pricing.server_types[] | select(.name == $st) | .prices[] | select(.location == $loc) | [.price_monthly.net, .price_hourly.net, .included_traffic] | @tsv')"
MONTHLY="$(awk '{print $1}' <<<"$PRICE_ROW")"
HOURLY="$(awk '{print $2}' <<<"$PRICE_ROW")"
TRAFFIC_BYTES="$(awk '{print $3}' <<<"$PRICE_ROW")"

echo "Plan:"
echo "  server: $SERVER_NAME"
echo "  type:   $SERVER_TYPE"
echo "  image:  $IMAGE"
echo "  loc:    $LOCATION"
echo "  price:  ${MONTHLY:-unknown} USD/month (${HOURLY:-unknown} USD/hour)"
echo "  traffic included bytes: ${TRAFFIC_BYTES:-unknown}"
echo "  ssh key: ${SSH_KEY_ID:-will create \"$SSH_KEY_NAME\" during --execute}"
echo "  tailscale: cloud-init joins as scriber-hil"
echo "  ufw: allow 80/443 public, allow all on tailscale0, deny other incoming"
echo

if [[ "$EXECUTE" != true ]]; then
  echo "Dry run only. No server, SSH key, volume, or DNS record was created."
  echo "To create the paid server after approval, run:"
  echo "  bash deploy/hetzner/provision-scriber-hil.sh --execute"
  exit 0
fi

if [[ "$SSH_KEYS_JSON" == "[]" ]]; then
  echo "SSH key creation failed or no SSH key id is available. Stop." >&2
  exit 1
fi

curl -fsS -X POST \
  -H "Authorization: Bearer $HETZNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_PAYLOAD" \
  https://api.hetzner.cloud/v1/servers | jq '{server: {id: .server.id, name: .server.name, status: .server.status, ipv4: .server.public_net.ipv4.ip, ipv6: .server.public_net.ipv6.ip}, action: .action.id}'
