# Scriber

> A two-agent voice architecture for real-time standup facilitation.

Built for **OpenAI Voice Hack Night**, Cerebral Valley — Wed May 27 2026.

---

## Thesis

Every existing meeting AI (Spinach, Otter, Fireflies, Fellow, MeetGeek) is **passive-then-active**: it listens, then post-meeting it acts. Scriber flips this. The agent **acts during the conversation**, with the Linear board visibly mutating live. A second silent agent runs in parallel, holds long-term cross-standup memory, and whispers tactical guidance.

This is a primitive nobody has shipped: **a two-agent voice architecture where one agent runs the meeting and another remembers everything across meetings.**

## The Two Agents

| Agent | Role | Voice | Model | Reasoning |
|---|---|---|---|---|
| **Scriber** | Facilitator — joins the call, prompts each speaker, executes tools live | `cedar` | `gpt-realtime-2` | `medium` (low latency) |
| **Mnemo** | Supervisor — never speaks into the call, whispers guidance to Scriber over a side-channel | silent (text only) | `gpt-realtime-2` | `xhigh` (deep thinking) |

Scriber moves fast and talks. Mnemo thinks deep and remembers. They share state over a WebSocket.

## What Scriber Does Live

- Joins Google Meet / Zoom as a participant
- Opens standup, prompts each teammate by name
- Listens for: what they did, what they're doing, what's blocking them
- **Executes Linear actions as the conversation happens**:
  - Creates / updates tickets
  - Changes status, assignee, priority
  - Adds comments with markdown
  - Generates diagrams via `gpt-image-1` and attaches them to tickets
- Posts a verbal + Slack recap at the end
- Respects mode switches: `Scriber, listen only` / `Scriber, quiet` / `Hey Scriber` / `Scriber, you're back`

## Demo

3-minute submission video shows:
1. Standup opens, Scriber prompts the team
2. Blocker mentioned → ticket updated live on a visible Linear board
3. Visual idea surfaces → Scriber generates a diagram via `gpt-image-1` → attaches to ticket → **image appears on the ticket in the Linear UI during the call**
4. Mnemo whispers historical context → Scriber voices it: *"Looks like Ben committed to spiking this Tuesday — should we reassign?"*
5. Mode switch: *"Scriber, quiet"* → silence → *"Scriber, you're back"* → resume
6. Standup wraps. Verbal recap. Slack message appears.

## Quickstart

> Pre-built on macOS with BlackHole 2ch for audio routing into Meet/Zoom.

```bash
# 1. Install audio bridge (one-time)
brew install --cask blackhole-2ch
# Open Audio MIDI Setup → create Multi-Output Device (BlackHole + Built-in Speakers)

# 2. Clone + install
git clone https://github.com/benikigai/scriber.git
cd scriber
bun install

# 3. Configure
cp .env.example .env.local
# Fill: OPENAI_API_KEY, LINEAR_API_KEY, SLACK_WEBHOOK_URL

# 4. Run
bun dev                 # Scriber + UI on :3000
bun run mnemo           # Mnemo supervisor sidecar (in a second terminal)

# 5. In your browser
# - Set mic to BlackHole 2ch, output to Multi-Output Device
# - Join your Meet/Zoom call with the same audio settings
# - Scriber is now in the meeting
```

## Repo Layout

```
scriber/
├── README.md              ← you are here
├── ARCHITECTURE.md        ← system diagram + data flow + audio routing
├── docs/specs/
│   ├── scriber.md         ← full approved spec (from /spec)
│   ├── scriber-yolo.md    ← task checkboxes for /yolo
│   ├── scriber-forge.json ← autonomous-exec config for /forge
│   └── scriber-context.md ← phase snapshot
├── src/                   ← Next.js app (Scriber + tool API routes + UI)
├── mnemo/                 ← Bun sidecar (Mnemo supervisor agent)
└── public/
    └── fallback-diagram.png  ← pre-staged image for live demo
```

## Status

**2026-05-27** — spec approved, 8 tasks queued, execution in progress via `/yolo`. Submission deadline 6:30 PM PDT tonight.

## Roadmap (post-hackathon)

- Recall.ai for real "Scriber (AI)" tile in Meet/Zoom participant grid (replace BlackHole)
- Mem0 / Qdrant for Mnemo's real long-term memory (replace mock JSON)
- Linear Agent SDK identity (Scriber as a first-class Linear agent)
- Multi-team support; multi-meeting-type (retros, planning, demos)

## License

Private — hackathon submission. License TBD post-event.
