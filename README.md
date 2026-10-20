# Scriber

**An AI meeting agent that runs your standup and acts during the call, not after it.**

> **Status:** Started at OpenAI Voice Hack Night (Cerebral Valley), San Francisco, 2026-05-27. Extended in June 2026 into a hosted beta with a Google Meet bot runtime at [usescriber.com](https://usescriber.com). No commits since 2026-06-12.

[usescriber.com](https://usescriber.com) · [Hackathon dashboard (Vercel)](https://scriber-nine.vercel.app)

## What it does

Most meeting AI is passive: it listens, then acts after the meeting. Scriber acts *during* the conversation, with the Linear board visibly changing as people talk.

- Opens the standup and prompts each teammate by name: what they did, what's next, what's blocking them.
- Executes Linear actions live: create and update tickets, change status, assignee and priority, add comments.
- Generates diagrams with `gpt-image-1` and attaches them to tickets during the call.
- Posts a spoken and Slack recap at the end.
- Respects mode switches: *"Scriber, listen only"*, *"Scriber, quiet"*, *"Hey Scriber"*, *"Scriber, you're back"*.

A second, silent agent, **Mnemo**, runs alongside as a supervisor. It never speaks into the call; it reads the transcript, checks prior commitments in memory and whispers guidance to Scriber (*"Looks like Ben committed to spiking this Tuesday — should we reassign?"*).

## How it works

| Agent | Role | Model | Reasoning |
|---|---|---|---|
| **Scriber** | Facilitator: speaks, runs tools | OpenAI Realtime (`gpt-realtime-2`) over WebRTC | medium (low latency) |
| **Mnemo** | Supervisor: silent, text only | OpenAI Realtime, text | xhigh |

```
Meet / Zoom call  <── audio ──>  Scriber (Realtime voice agent)
                                   ├── tools: Linear, diagram (gpt-image-1), Slack
                                   ├── wake-word state machine: ALWAYS_ON → LISTEN → ACTIVE → QUIET
                                   └── WebSocket ⇄ Mnemo (supervisor; memory + whispers)
Dashboard: live transcript, mode, tool-call cards
```

**Hackathon version (May 27):** a browser page joined the call through a virtual audio device (BlackHole on macOS); Mnemo was a Bun sidecar with a mock JSON memory (`mnemo/memory.json`).

**Hosted version (June):** a Next.js app with a password-gated dashboard, a Google Meet bot runtime (Playwright + Chromium) with a Realtime WebSocket bridge, a scheduler worker, Google Calendar sync, connector onboarding and approve/reject tool proposals. It ran via Docker Compose behind Caddy on a dedicated cloud host (runbook in [`docs/HETZNER.md`](docs/HETZNER.md)). A Zoom SDK runtime is stubbed.

Full diagram and data flow: [ARCHITECTURE.md](ARCHITECTURE.md).

## Stack

Next.js 15 · React 19 · TypeScript · OpenAI Realtime API + Agents SDK · `gpt-image-1` · Linear SDK · Slack webhooks · Playwright · WebSockets · Docker Compose + Caddy. Based on OpenAI's [openai-realtime-agents](https://github.com/openai/openai-realtime-agents) example.

## Run locally

```bash
npm install
cp .env.example .env.local   # OPENAI_API_KEY, LINEAR_API_KEY, SLACK_WEBHOOK_URL, ...

npm run dev                  # dashboard + Scriber on http://localhost:3000
npm run bridge               # Realtime bridge (hosted runtime)
npm run worker               # meeting scheduler (hosted runtime)
npm run meet-runtime         # Google Meet bot
npm test
```

For the original hackathon setup (browser joins the call directly), route a virtual audio device such as BlackHole 2ch as the browser's mic and a multi-output device as its speaker; see [`docs/DEMO.md`](docs/DEMO.md).

## Roadmap ideas (not built)

- A real participant tile via a meeting-bot provider instead of audio routing for the browser mode.
- Real long-term memory for Mnemo instead of the mock JSON file.
- Scriber as a first-class Linear agent identity; retros, planning and demo meeting types.

## Related repos

- [scriber-landing](https://github.com/benikigai/scriber-landing) — the original static landing page. Superseded: `usescriber.com` is now served by this app's own landing route.

## Credits

Built by [Ben Shyong](https://github.com/benikigai). Hackathon hosted by Cerebral Valley and OpenAI. No license file yet; the upstream OpenAI example is MIT-licensed.
