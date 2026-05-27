# Context: Scriber + Mnemo
**Last updated:** 2026-05-27
**Phase:** Spec approved
**Approved option:** A — Fork `openai-realtime-agents` (Next.js + browser WebRTC) + Bun sidecar for Mnemo
**Tasks:** 8 (Simple: 2, Moderate: 5, Complex: 1)
**Key risks:**
- Live `gpt-image-1` latency (5-25s) creates dead air — mitigated with verbal filler + low/jpeg + pre-staged fallback
- Mnemo↔Scriber WS coordination flakiness — hard kill-switch at 25min, ship single-agent if buggy
- Submission deadline 6:30 PM PDT 2026-05-27 — clean take by 6:00 PM, 30 min buffer

**Critic verdict:** APPROVE with concerns (incorporated):
- Use `@linear/sdk` GraphQL direct, NOT MCP, for binary attachments (confirmed flaky by research)
- Solo recording requires Multi-Output Device + soundboard for pre-recorded teammate clips
- Pre-stage fallback diagram PNG for image-gen 429 path

**Research:** Embedded inline in `docs/specs/scriber.md` (Research Notes section). No separate research doc.

**Critical paths:**
- Tasks 0 → 1 (Linear/OpenAI keys + first Realtime session running)
- Tasks 1 → 2 → 5 (Linear tools → image gen + attach)
- Tasks 1 → 3 (wake-word — kill-switch if flaky)
- Tasks 1, 2 → 4 (Mnemo — kill-switch if flaky)
- Tasks 1-5 → 6 → 7 (UI polish → record → submit)
