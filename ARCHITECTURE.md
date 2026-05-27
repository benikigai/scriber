# Scriber — Architecture

**Last updated:** 2026-05-27
**Status:** Pre-implementation (spec approved, execution starting)

## System diagram

```
                      ┌────────────────────────────┐
                      │  Google Meet / Zoom call   │
                      │  3 humans + Scriber        │
                      └──────────┬─────────────────┘
                                 │  audio in/out
                                 │  (BlackHole 2ch)
                                 │
                 ┌───────────────┴───────────────────┐
                 │      Browser (Next.js page)        │
                 │                                    │
                 │  ┌──────────────────────────────┐  │
                 │  │  Scriber (Facilitator)       │  │
                 │  │  WebRTC → OpenAI Realtime-2  │  │
                 │  │  voice: cedar, reasoning:    │  │
                 │  │  medium                       │  │
                 │  │  Tools: linear.*, diagram,   │  │
                 │  │   slack.post_message          │  │
                 │  └──────────────────────────────┘  │
                 │             │            ▲          │
                 │             │ transcript │ whispers │
                 │             ▼            │          │
                 │  ┌──────────────────────────────┐  │
                 │  │  Wake-word state machine     │  │
                 │  │  ALWAYS_ON → LISTEN → ACTIVE │  │
                 │  │  → QUIET → previous          │  │
                 │  └──────────────────────────────┘  │
                 │             │                       │
                 │             ▼                       │
                 │  ┌──────────────────────────────┐  │
                 │  │  Demo UI panels              │  │
                 │  │  - Live transcript + mode    │  │
                 │  │  - Tool-call cards           │  │
                 │  │  - Linear board (2nd window) │  │
                 │  └──────────────────────────────┘  │
                 └──────────┬─────────────────────────┘
                            │ WS: transcript out
                            │ WS: whispers in
                            ▼
                 ┌────────────────────────────────┐
                 │  Mnemo (Supervisor)            │
                 │  Bun sidecar process            │
                 │  text-only Realtime-2           │
                 │  reasoning: xhigh                │
                 │  Tools: linear (read),           │
                 │   rag.search_past_standups,      │
                 │   whisper_to_scriber             │
                 └────────────┬───────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Mock standup memory     │
                │  mnemo/memory.json       │
                │  (last 5 standups)       │
                └──────────────────────────┘

                 External APIs called from Next.js API routes:
                 - Linear GraphQL (@linear/sdk)
                 - OpenAI Images (gpt-image-1)
                 - Slack incoming webhook
```

## Process model

Two processes, one developer machine:

| Process | What it does | Where |
|---|---|---|
| `bun dev` | Next.js — UI + Scriber's browser session + tool API routes | `:3000` |
| `bun run mnemo` | Bun sidecar — Mnemo's Realtime session + whisper bus | `:3100` (WS) |

The Next.js process is the hub. Scriber lives in the browser tab; tool calls go server-side via Next.js API routes. Mnemo connects to Next.js over WS, receives the live transcript, and sends back short text whispers that are injected into Scriber's input.

## Audio routing (BlackHole 2ch, macOS)

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  My voice   │────────▶│ Built-in mic │────┐    │             │
└─────────────┘         └──────────────┘    │    │  Browser    │
                                            │    │  (Scriber)  │
┌─────────────┐         ┌──────────────┐    │    │             │
│  Scriber    │────────▶│  BlackHole   │◀───┴───▶│  Mic input  │
│  TTS out    │         │  2ch         │         │  = BlackHole│
└─────────────┘         └──────┬───────┘         │             │
                               │                  │  Speaker    │
                               ▼                  │  out = Multi│
                        ┌──────────────┐         │  Output Dev │
                        │ Meet/Zoom    │         └─────────────┘
                        │ mic input =  │
                        │ BlackHole    │
                        └──────────────┘
```

**Solo recording note:** the demo is recorded solo. Pre-recorded teammate-voice clips are played from a soundboard, routed into the Meet via the same BlackHole channel. Scriber hears everything in the Meet via the browser's mic = BlackHole.

**Critical:** monitor via Multi-Output Device (BlackHole + built-in speakers). Never run laptop speakers + BlackHole mic simultaneously without monitoring — feedback loop.

## Wake-word state machine

```
states: ALWAYS_ON | LISTENING_FOR_WAKE | ACTIVE | QUIET

transitions:
  ALWAYS_ON      ── "scriber, sleep" / "scriber, listen only" ──▶ LISTENING_FOR_WAKE
  LISTEN_FOR_WAKE── "hey scriber"  ──────────────────────────────▶ ACTIVE
  ACTIVE         ── response complete + 5s silence ──────────────▶ LISTEN_FOR_WAKE
  any            ── "scriber, quiet" / "scriber, mute" ──────────▶ QUIET
  QUIET          ── "scriber, you're back" / "scriber, resume" ──▶ previous state
  any            ── "scriber, always on" ────────────────────────▶ ALWAYS_ON
```

Detection runs **client-side on the live Realtime transcript** — substring match on the most recent N tokens. No separate wake-word model. False-positive mitigation: 200ms confirmation gate if needed.

Default starting mode for the demo: **ALWAYS_ON**.

## Tool surface

### Scriber's tools (executed via Next.js API routes)

| Tool | What it does | Backend |
|---|---|---|
| `linear.search_issues(filters)` | Find tickets by assignee/status/label | `@linear/sdk` GraphQL |
| `linear.get_issue(id)` | Full ticket detail + comments | `@linear/sdk` GraphQL |
| `linear.create_issue({...})` | New ticket | `@linear/sdk` GraphQL |
| `linear.update_issue(id, fields)` | Change status/assignee/due date | `@linear/sdk` GraphQL |
| `linear.add_comment(id, body)` | Markdown comment | `@linear/sdk` GraphQL |
| `linear.attach_image(id, image_url)` | Attach image to ticket | 3-step: `fileUpload` → PUT → `attachmentCreate` |
| `generate_diagram({prompt, style, attach_to})` | gpt-image-1 → Linear attach | OpenAI Images + above |
| `slack.post_message({channel, body})` | Recap to Slack | Slack incoming webhook |

### Mnemo's tools (read-only + side channel)

| Tool | What it does |
|---|---|
| `linear.search_issues` (read) | Same as Scriber's, read-only |
| `linear.get_issue` (read) | Ticket history |
| `rag.search_past_standups(query)` | In-memory search over `mnemo/memory.json` mock |
| `whisper_to_scriber(message)` | Send short text instruction over WS |

## Why two agents

**Scriber needs to be fast.** Conversational latency is the demo's first impression. Reasoning effort = `medium`.

**Mnemo can be slow.** She's not holding the call. Reasoning effort = `xhigh`. She has time to chew on long context, search prior standups, identify patterns, and form one good whisper.

Single-agent equivalents either talk too slow (high reasoning blocking response) or surface shallow insights (low reasoning blocking depth). Splitting decouples conversational responsiveness from analytical depth.

## What's deferred to v1

| Deferred | Why now | What replaces it |
|---|---|---|
| Recall.ai (real "Scriber" tile in Meet) | Setup cost > 30 min | BlackHole — Scriber audio appears as "Ben's mic" |
| Mem0 / Qdrant for Mnemo memory | Setup cost > 30 min | Mock JSON file with 5 prior-standup summaries |
| Linear Agent SDK identity | Requires Linear partnership | Standalone web app calling Linear API as Ben |
| Multi-team support | Out of scope for demo | BenIkigai workspace hardcoded |

## Risk register

1. **Live `gpt-image-1` latency (5-25s)** — Scriber must verbally fill ("sketching it now…"); pre-staged fallback at `public/fallback-diagram.png` if API 429s.
2. **Mnemo↔Scriber WS coordination** — hard kill-switch: ship single-agent if dual-session is flaky at the 25-min checkpoint.
3. **BlackHole feedback loop** — explicit monitoring via Multi-Output Device; never speakers + BlackHole mic without it.
4. **Wake-word false positives** — fallback to ALWAYS_ON + UI mute button if voice-triggered transitions misfire.
5. **Submission deadline 6:30 PM PDT** — record clean take by 6:00 PM, 30 min buffer for edit + submit.

## Reference

See `docs/specs/scriber.md` for the full approved spec, task decomposition, and acceptance criteria.
