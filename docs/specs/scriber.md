# Spec: Scriber + Mnemo — real-time agentic standup facilitator

**Date:** 2026-05-27
**Status:** Approved
**Approved option:** A — Fork `openai-realtime-agents` (Next.js, browser-WebRTC) + Bun sidecar for Mnemo
**Complexity:** Moderate (8 tasks; 1 Complex, 5 Moderate, 2 Simple)
**Submission target:** OpenAI Voice Hack Night, Cerebral Valley, 2026-05-27 6:30 PM PDT

## Context

Build a two-agent voice system for OpenAI Voice Hack Night:

- **Scriber** (facilitator) — joins a Google Meet / Zoom standup, talks like a colleague, executes real Linear actions live as the conversation unfolds (creates tickets, updates status, attaches auto-generated diagrams via `gpt-image-1`, posts Slack recaps).
- **Mnemo** (supervisor) — silent, runs in parallel, holds long-term cross-standup memory, whispers tactical guidance to Scriber over a private WS side-channel.

Thesis: every existing meeting AI is passive-then-active (listen, then act post-meeting). Scriber + Mnemo flip this — the Linear board mutates *during* the conversation. The two-agent architecture decouples conversational responsiveness (Scriber, low reasoning) from analytical depth (Mnemo, xhigh reasoning).

Solo build, ~2.5h window, demo deliverable is a 3-min video.

## Decisions

| Decision | Choice | Reason |
|---|---|---|
| Architecture | Fork `openai-realtime-agents` (Next.js + browser WebRTC) + Bun sidecar for Mnemo | Fork = ~45 min of working baseline; documented happy path for browser audio + Realtime tool calls; one language (TS) end-to-end |
| Agent names | Scriber (facilitator), Mnemo (supervisor) | Renamed from "Cleo" to avoid collision with existing Cleo VPS guest-hospitality bot |
| Linear workspace | BenIkigai | Personal workspace, low blast radius for demo writes |
| Runtime | Bun + TypeScript | Single language; fast cold start; matches forked Next.js fork's ecosystem |
| Audio bridge | BlackHole 2ch + Multi-Output Device | Lowest-risk path; ~15 min setup; no vendor lock-in; Recall.ai deferred to v1 |
| Linear attachments | `@linear/sdk` GraphQL direct (NOT MCP) | MCP binary upload is flaky per research; 3-step flow: `fileUpload` → PUT bytes to S3 → `attachmentCreate` |
| Image generation | `gpt-image-1` quality=`low`, format=`jpeg` | Latency: 5-10s at low/jpeg vs 10-25s at medium/png; verbal filler covers gap; pre-staged fallback PNG for 429s |
| Mnemo memory | Mock JSON file (last 5 standups) | Mem0/Qdrant deferred to v1 |
| Default mode | `ALWAYS_ON` | Demos the live-action premise immediately; mode switches shown later in script |
| Demo participants | Solo recording with pre-recorded teammate clips | Confirmed by user — no live teammates on demo call |

## Tasks

### Task 0: Pre-flight — install + audio routing + key verification

- **Objective:** Get BlackHole, Multi-Output Device, Linear/OpenAI/Slack keys, and a teammate-voice soundboard ready before any code.
- **Complexity:** Simple
- **Dependencies:** None
- **Files to change:** none (system config + `.env.local`)
- **Acceptance criteria:**
  - `brew install --cask blackhole-2ch` succeeds, BlackHole 2ch visible in Audio MIDI Setup
  - Multi-Output Device created aggregating BlackHole + Built-in Speakers
  - `.env.local` populated with `OPENAI_API_KEY`, `LINEAR_API_KEY` (BenIkigai), `SLACK_WEBHOOK_URL` from 1Password Clawdbot vault
  - Smoke test: `bun -e "const r = await fetch('https://api.linear.app/graphql', {method:'POST', headers:{'Authorization': process.env.LINEAR_API_KEY, 'Content-Type':'application/json'}, body: JSON.stringify({query:'{ viewer { name email } }'})}); console.log(await r.json())"` returns viewer
- **Test plan:**
  - Smoke: play a tone into a Meet test call via BlackHole; confirm Meet hears it
- **Rollback plan:** Switch Meet back to built-in mic; no code rollback needed
- **Blast radius:** macOS audio config only
- **Research needed:** No

### Task 1: Scaffold — fork `openai-realtime-agents`, single Scriber agent end-to-end

- **Objective:** Working browser-side Scriber that hears my voice via BlackHole and responds with TTS into BlackHole.
- **Complexity:** Moderate
- **Dependencies:** Task 0
- **Files to change:** clone into `~/code/scriber/`, edit `src/app/agentConfigs/` to add `scriber.ts`, swap voice to `cedar`, swap model id to `gpt-realtime-2`, set system prompt to facilitator persona
- **Acceptance criteria:**
  - `bun dev` runs; browser at `:3000` connects to OpenAI Realtime
  - Scriber responds to spoken input within 1.5s latency
  - Voice is `cedar`, persona is facilitator (system prompt v1 from brief)
  - Browser mic = BlackHole; speaker = Multi-Output (BlackHole + monitor)
- **Test plan:**
  - Smoke: 30-sec conversation, no audio feedback loop, latency under 1.5s p95
- **Rollback plan:** Fallback to OpenAI's default agent config if Scriber config breaks
- **Blast radius:** Local fork only
- **Research needed:** No

### Task 2: Linear tools (read + write, excluding attachments)

- **Objective:** Wire 5 Linear tools as Next.js API routes; expose to Scriber as function calls.
- **Complexity:** Moderate
- **Dependencies:** Task 1
- **Files to change:**
  - `src/lib/linear.ts` (SDK client init)
  - `src/app/api/tools/linear/search/route.ts`
  - `src/app/api/tools/linear/get/route.ts`
  - `src/app/api/tools/linear/create/route.ts`
  - `src/app/api/tools/linear/update/route.ts`
  - `src/app/api/tools/linear/comment/route.ts`
  - `src/app/agentConfigs/scriber.ts` (tool definitions)
- **Acceptance criteria:**
  - Verbal "Scriber, what's on my board?" returns 3+ real ticket titles from BenIkigai
  - Verbal "Create a ticket called Test Demo" creates issue in BenIkigai; ticket ID echoed back
  - Verbal "Mark INJ-X as in progress" updates status; visible in Linear UI
  - Verbal "Add a comment to INJ-X saying hello" appends comment
- **Test plan:**
  - Smoke: each of 5 tools invoked once via voice, verified in Linear UI
- **Rollback plan:** Disable individual tool by removing from agent config
- **Blast radius:** BenIkigai Linear workspace (real writes — demo data is fine)
- **Research needed:** No

### Task 3: Wake-word state machine

- **Objective:** Implement `ALWAYS_ON | LISTENING_FOR_WAKE | ACTIVE | QUIET` state machine consuming Realtime transcript events; gate TTS output by state.
- **Complexity:** Moderate
- **Dependencies:** Task 1
- **Files to change:**
  - `src/lib/modeMachine.ts` (state + transitions)
  - `src/lib/transcriptListener.ts` (substring match on recent N tokens)
  - `src/app/components/ModeIndicator.tsx` (UI badge)
  - Hook into Realtime client's transcript stream + TTS mute gate
- **Acceptance criteria:**
  - "Scriber, listen only" → silent until "Hey Scriber" → ACTIVE → responds → 5s silence → back to LISTENING_FOR_WAKE
  - "Scriber, quiet" mid-response → immediate TTS halt + single-word ack
  - "Scriber, you're back" → resume prior mode
  - UI indicator reflects current mode in real time
- **Test plan:**
  - Smoke: speak each of the 5 transition phrases; verify state transitions in console + UI badge
- **Rollback plan:** **HARD KILL-SWITCH at 25-min mark — if flaky, ship ALWAYS_ON only + UI mute button**
- **Blast radius:** None (local UX)
- **Research needed:** No

### Task 4: Mnemo sidecar

- **Objective:** Bun process running text-only Realtime as Mnemo; subscribes to live transcript via WS from Next.js; emits `whisper_to_scriber(message)` over WS back into Scriber's input.
- **Complexity:** Complex
- **Dependencies:** Tasks 1, 2
- **Files to change:**
  - `mnemo/index.ts` (Bun entry + Realtime client)
  - `mnemo/memory.json` (preloaded mock standup history — 5 fake recaps with keywords)
  - `mnemo/tools.ts` (read-only Linear queries + `rag.search_past_standups`)
  - `src/app/api/whispers/route.ts` (WS endpoint, both directions)
  - `src/lib/whisperBus.ts` (browser-side WS client + Scriber-input injection)
- **Acceptance criteria:**
  - `bun run mnemo` connects to Next.js WS, logs handshake
  - When transcript contains a keyword from mock memory (e.g., "latency"), Mnemo emits whisper within ~3s
  - Scriber voices the whisper naturally in her next response
- **Test plan:**
  - Smoke: speak "the latency issue from Tuesday" — verify Mnemo whisper fires in mnemo console + Scriber surfaces it in next turn
- **Rollback plan:** **HARD KILL-SWITCH at 25-min mark — if dual-session is buggy, ship single-agent; mention Mnemo in roadmap slide of demo**
- **Blast radius:** None
- **Research needed:** No

### Task 5: Image generation + Linear attachment pipeline

- **Objective:** Wire `generate_diagram` tool — call `gpt-image-1` (quality=`low`, format=`jpeg`), decode base64, run Linear's 3-step `fileUpload` → PUT → `attachmentCreate`, return attachment URL.
- **Complexity:** Moderate
- **Dependencies:** Task 2
- **Files to change:**
  - `src/app/api/tools/diagram/route.ts` (image gen + attachment orchestration)
  - `src/lib/linearAttach.ts` (3-step upload helper)
  - `src/app/agentConfigs/scriber.ts` (add `generate_diagram` tool def)
  - `public/fallback-diagram.png` (pre-staged image for 429 path)
- **Acceptance criteria:**
  - Verbal "sketch a diagram of the gateway flow and attach to INJ-58" → image appears on the Linear ticket within ~15s
  - If `gpt-image-1` returns 429, fallback PNG is uploaded instead and verbally acknowledged
- **Test plan:**
  - Smoke: trigger image gen for one real BenIkigai ticket; verify attachment renders in Linear UI
  - Failure: simulate 429 by short-circuiting API call; verify fallback path works
- **Rollback plan:** Disable tool; Scriber falls back to "I'll sketch this after the call" verbal response
- **Blast radius:** OpenAI image-gen rate limit + Linear attachment count on demo tickets
- **Research needed:** No (completed in Phase 2)

### Task 6: Slack recap tool + demo UI panels

- **Objective:**
  - (a) `slack.post_message` tool via Slack incoming webhook
  - (b) Three-panel demo UI: live transcript with mode badge, tool-call cards firing inline, Linear board open in a 2nd browser window (no iframe)
- **Complexity:** Moderate
- **Dependencies:** Tasks 1, 2, 3, 5
- **Files to change:**
  - `src/app/api/tools/slack/route.ts` (webhook POST)
  - `src/app/page.tsx` (3-panel layout)
  - `src/app/components/TranscriptPanel.tsx`
  - `src/app/components/ToolCallCard.tsx` (status: pending / done / failed)
  - `src/app/components/ModeIndicator.tsx` (from Task 3, finalized)
- **Acceptance criteria:**
  - End-of-standup Slack message visible in target channel
  - UI shows transcript scroll, mode indicator changes in real time, every tool call appears as a card
  - Layout is screen-recording-ready (no dev banners, no console errors visible)
- **Test plan:**
  - Smoke: full 60-sec mock standup ends with Slack post + UI shows ≥3 tool-call cards
- **Rollback plan:** Drop tool-call cards if running over; ship transcript + mode indicator only
- **Blast radius:** Slack channel post (use private demo channel)
- **Research needed:** No

### Task 7: Dress rehearsal + record + submit

- **Objective:** One full take of the 3-min demo script. Edit if needed. Submit by 6:30 PM PDT.
- **Complexity:** Simple
- **Dependencies:** All above
- **Files to change:** none
- **Acceptance criteria:**
  - 3-min video recorded (QuickTime or OBS) covering: standup open → live Linear update → diagram generation → Mnemo whisper → quiet mode demo → Slack recap
  - Submission form completed before 6:30 PM PDT
- **Test plan:** Watch video end-to-end before submitting; verify audio levels and Linear board visibility
- **Rollback plan:** Submit shorter cut if recording overruns
- **Blast radius:** Submission deadline

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Live `gpt-image-1` latency (5-25s) is dead air | High | Medium | Verbal filler ("sketching it now…") + low/jpeg quality + pre-staged fallback PNG |
| Mnemo↔Scriber WS coordination flaky | Medium | High | Hard kill-switch at 25-min mark; ship single-agent and mention Mnemo in roadmap |
| BlackHole feedback loop during recording | Medium | High | Multi-Output Device for monitor; never speakers + BlackHole mic without it |
| Wake-word false positives ("Scriber" in normal speech) | Medium | Low | Fallback to ALWAYS_ON + UI mute button if voice-triggered transitions misfire |
| Submission deadline (6:30 PM PDT) slip | Medium | Critical | Hard checkpoint: clean take by 6:00 PM, 30 min buffer for edit + submit |
| Linear MCP attachment upload flakiness | Verified | Avoided | Use `@linear/sdk` GraphQL direct, skip MCP for binary uploads |

## Research Notes

Phase 2 research findings (in-line; no separate research doc):

1. **OpenAI Realtime dual concurrent sessions — safe.** No per-key cap for two sessions. Constraints are RPM/TPM and audio-minutes-per-minute tier limits. Mnemo stays text-only to conserve audio budget. Cite: https://community.openai.com/t/maximum-number-of-parallel-real-time-sessions-on-a-single-openai-api-key/1362278
2. **Linear MCP attachments — flaky for binary.** Use `@linear/sdk` GraphQL directly. Mutation: `fileUpload(size, filename, contentType) { uploadFile { uploadUrl assetUrl headers } }` → PUT bytes to `uploadUrl` with returned headers → `attachmentCreate(input: { issueId, title, url: assetUrl })`. Cite: https://linear.app/developers/how-to-upload-a-file-to-linear
3. **`gpt-image-1` — base64 only, no URL.** Latency: 10-25s at medium/png, 5-10s at low/jpeg, ~30-60s at high. Has its own image-per-minute tier limit separate from chat TPM. Cite: https://community.openai.com/t/gpt-image-1-model-experiencing-delayed-api-responses/1322483
