# Demo runbook — Scriber + Mnemo

> Submission target: OpenAI Voice Hack Night, 2026-05-27 6:30 PM PDT.

## Two recording paths

### Path A — Direct browser demo (simplest, no BlackHole)

Talk to Scriber in the browser at `localhost:3002` while screen-recording. No Meet, no audio bridge needed. The demo is *Scriber updating Linear live*, which is fully visible in the screen recording.

1. Run the app:
   ```bash
   cd ~/code/scriber
   bun dev
   ```
2. Open `http://localhost:3002` in Chrome.
3. In the agent dropdown, select **scriber** (it should be default).
4. Click **Connect**.
5. Open `https://linear.app/benikigai/team/BEN/active` in a 2nd window (side-by-side with the browser).
6. Start screen recording with QuickTime or OBS (Cmd+Shift+5 → "Record Selected Portion"). Capture both windows + microphone audio.
7. Run through the script below.

### Path B — Through Google Meet (requires BlackHole — install needed)

If you want Scriber to literally appear in a Meet call:

1. Install BlackHole (interactive sudo required):
   ```bash
   brew install --cask blackhole-2ch
   ```
2. In **Audio MIDI Setup** → create a Multi-Output Device aggregating BlackHole 2ch + Built-in Speakers.
3. In Chrome's site settings for localhost: set mic to **BlackHole 2ch**, output to **Multi-Output Device**.
4. In Meet: set mic to **BlackHole 2ch**, output to **Multi-Output Device**.
5. Now Scriber's TTS goes into the Meet via BlackHole, and you hear yourself + Scriber via the monitor speakers.
6. Continue with the script.

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

- [ ] `bun dev` running, `http://localhost:3002` loads
- [ ] Browser console open (F12) — useful to see tool-call breadcrumbs
- [ ] Linear web UI open in 2nd window, filtered to BEN team
- [ ] Slack webhook either configured OR ok with verbal-only recap
- [ ] Mic level checked (talk and confirm waveform in QuickTime)
- [ ] Quiet room
- [ ] BEN-41 (or another live ticket) ready to be the demo target

## Known quirks during recording

- **gpt-image-1 takes ~20-25 seconds** at quality=low. Scriber's prompt includes "sketching it now…" filler. If she goes silent, prompt her: "Tell me what you're drawing."
- **First tool call after connect** may have a ~2s warmup. Subsequent calls are snappier.
- **Mnemo whisper** is reactive — call `consult_mnemo` via a verbal nudge ("anything you'd flag, Mnemo?"). It takes 3-6s.
- **Audio feedback loop** — if you ever hear Scriber through your laptop speakers AND your mic is on, mute the speakers immediately or use headphones.

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
