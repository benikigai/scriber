import assert from "node:assert/strict";
import test from "node:test";
import {
  nextWakeStateAfterUtterance,
  shouldRespondToUtterance,
  type WakeState,
} from "../src/server/meetingBots/wake";

test("wake mode responds only when addressed", () => {
  const state: WakeState = { wakeMode: "wake", active: false, muted: false };
  assert.equal(shouldRespondToUtterance(state, "any thoughts?"), false);
  assert.equal(shouldRespondToUtterance(state, "Scriber, summarize that"), true);
});

test("quiet utterance moves Scriber into listen-only mute state", () => {
  const state = nextWakeStateAfterUtterance(
    { wakeMode: "wake", active: true, muted: false },
    "Scriber, quiet",
  );
  assert.deepEqual(state, { wakeMode: "listen_only", active: false, muted: true });
  assert.equal(shouldRespondToUtterance(state, "Scriber, update that ticket"), false);
});
