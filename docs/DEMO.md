# Demo runbook — Scriber + Mnemo

> Submission target: OpenAI Voice Hack Night, 2026-05-27 6:30 PM PDT.

## Recording setup (MBP via SSH tunnel — chosen path)

`bun dev` runs on the **Mac Mini Elias** (`100.85.105.99`). You record from the **MBP** via an SSH port-forward, so the MBP browser becomes the recording surface.

The URL bar will show `usescriber.com:3000` thanks to a `/etc/hosts` rewrite on the MBP. Domain rebrand is cosmetic — the traffic still tunnels to the Mini's localhost.

### One-time MBP setup

```bash
# On MBP — paste once, prompts for sudo password
echo "127.0.0.1 usescriber.com" | sudo tee -a /etc/hosts
```

To reverse later: `sudo sed -i '' '/usescriber.com/d' /etc/hosts`

### Each recording session

```bash
# On MBP — open the SSH tunnel; leave the session open while recording
ssh -L 3000:localhost:3000 eliass-mac-mini.tail365038.ts.net
```

### On the Mac Mini (already running)

`bun dev` is running under `nohup`; check with:
```bash
# On Mini
pgrep -f 'next dev' && curl -fsS http://localhost:3000 -o /dev/null && echo OK
```
If it's down: `cd ~/code/scriber && nohup bun dev > /tmp/scriber-dev.log 2>&1 &`

### Then on MBP

1. Open Chrome at **`http://usescriber.com:3000`**
2. Agent dropdown → **scriber** (default)
3. Click **Connect** — grant mic permission
4. Open Linear in a 2nd window: `https://linear.app/benikigai/team/BEN/active`
5. Side-by-side both windows
6. Cmd+Shift+5 → "Record Selected Portion" → Options → set **Microphone** to MBP built-in mic
7. Press Record → follow the script below

## Demo script (~3 min)

| Time | What happens | Tool call expected |
|---|---|---|
| 0:00 | Title card overlay (added in edit): *"Scriber runs your standup. Mnemo remembers everything."* | — |
| 0:15 | You: *"Morning Scriber."* | — |
| 0:18 | Scriber greets, asks what's first | — |
| 0:25 | You: *"Show me what I have open in Linear."* | `linear_search_issues` — list appears in transcript breadcrumb |
| 0:45 | You: *"Mark BEN-41 as in progress and add a comment that we shipped the spike."* | `linear_update_issue` + `linear_add_comment` — Linear UI updates live in 2nd window |
| 1:10 | You: *"The gateway latency thing — sketch a diagram of the routing flow and attach it to BEN-41."* | `generate_diagram` — verbal filler from Scriber ("sketching it now…") for ~20s, then attachment appears on BEN-41 in Linear UI **(visceral moment)** |
| 1:50 | You: *"Anything we should be thinking about?"* | Scriber calls `consult_mnemo` → Mnemo whispers about gateway latency or hero image → Scriber voices it |
| 2:20 | You: *"OK wrap us up."* | Scriber generates verbal recap + calls `post_slack_recap` (logged to console if no webhook) |
| 2:40 | Closing card overlay: *"Scriber + Mnemo. Built tonight."* | — |

## Pre-flight checklist before pressing record

- [ ] SSH tunnel open from MBP to Mini (`ssh -L 3000:localhost:3000 …`)
- [ ] `bun dev` running on Mini (check `pgrep -f 'next dev'` over SSH)
- [ ] Chrome at `http://usescriber.com:3000` loads the Scriber UI
- [ ] Browser console open (Cmd+Opt+I) — tool-call breadcrumbs visible there
- [ ] Linear web UI open in 2nd window, filtered to BEN team
- [ ] Mic level checked (Cmd+Shift+5 Options → MBP Microphone)
- [ ] Quiet room
- [ ] BEN-41 (or another live ticket) ready to be the demo target
- [ ] Headphones on the MBP — prevents audio feedback when Scriber talks

## Known quirks during recording

- **gpt-image-1 takes ~20-25 seconds** at quality=low. Scriber's prompt includes "sketching it now…" filler. If she goes silent, prompt her: "Tell me what you're drawing."
- **First tool call after connect** may have a ~2s warmup. Subsequent calls are snappier.
- **Mnemo whisper** is reactive — call `consult_mnemo` via a verbal nudge ("anything you'd flag, Mnemo?"). It takes 3-6s.
- **Audio feedback loop** — wear headphones on the MBP. If Scriber comes out of MBP speakers while the mic is hot, you'll get echo into the recording.
- **SSH tunnel drops** — if WiFi flakes during recording, the SSH session might die mid-take. Reconnect with the same command; the dev server on the Mini keeps running.

## Fallback if SSH tunnel breaks during recording

The Mini's Tailscale IP is `100.85.105.99`. You can hit `http://100.85.105.99:3000` directly from MBP without the SSH tunnel — same Scriber, just less polished URL bar. The `/etc/hosts` rewrite doesn't apply to bare IPs.

## After recording

1. Watch the take end-to-end.
2. Trim front/back dead air in QuickTime.
3. Optionally add title/closing cards in iMovie (~5 min).
4. Submit to the OpenAI Voice Hack Night form by **6:30 PM PDT**.

## Submission talking points (for any text field)

- **What it does:** Two-agent voice architecture. Scriber facilitates standup live, executes Linear actions during the call. Mnemo silently holds long-term memory and whispers tactical context.
- **What's new:** Existing meeting AIs are passive-then-active (listen, then summarize). Scriber acts *during* the conversation — the Linear board mutates live. The two-agent split decouples conversational latency (Scriber, medium reasoning) from analytical depth (Mnemo, deep reasoning with cross-standup memory).
- **Stack:** OpenAI Realtime API (cedar voice), Responses API for Mnemo (gpt-5), gpt-image-1 for diagram generation, Linear GraphQL for ticket mutations and 3-step file attachment, Slack webhook for recap.
- **Built in:** ~3 hours, solo.
- **Repo:** github.com/benikigai/scriber
- **Demo URL shown in video:** usescriber.com (cosmetic rebrand of localhost via /etc/hosts during recording — production deploy is post-hackathon)
