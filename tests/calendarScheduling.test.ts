import assert from "node:assert/strict";
import test from "node:test";
import {
  joinAtForCalendarEvent,
  normalizeCalendarEvent,
  shouldAutoScheduleCalendarEvent,
} from "../src/server/meetingBots/calendar";

test("normalizes calendar event and schedules two minutes early", () => {
  const event = normalizeCalendarEvent({
    provider: "google",
    externalId: "event-1",
    title: "Design review",
    description: "Meet link: https://meet.google.com/abc-defg-hij",
    startsAt: "2026-06-11T15:00:00.000Z",
  });

  assert.ok(event);
  assert.equal(event.platform, "google_meet");
  assert.equal(joinAtForCalendarEvent(event), "2026-06-11T14:58:00.000Z");
});

test("skips declined, private, cancelled, and past events", () => {
  const future = normalizeCalendarEvent({
    provider: "microsoft",
    externalId: "event-2",
    title: "Standup",
    conferenceUrl: "https://benikigai.zoom.us/j/123456789",
    startsAt: "2026-06-11T15:00:00.000Z",
  });
  assert.ok(future);
  assert.equal(shouldAutoScheduleCalendarEvent(future, new Date("2026-06-11T14:00:00.000Z")), true);

  assert.equal(
    shouldAutoScheduleCalendarEvent({ ...future, responseStatus: "declined" }, new Date("2026-06-11T14:00:00.000Z")),
    false,
  );
  assert.equal(
    shouldAutoScheduleCalendarEvent({ ...future, visibility: "private" }, new Date("2026-06-11T14:00:00.000Z")),
    false,
  );
  assert.equal(
    shouldAutoScheduleCalendarEvent({ ...future, cancelled: true }, new Date("2026-06-11T14:00:00.000Z")),
    false,
  );
  assert.equal(shouldAutoScheduleCalendarEvent(future, new Date("2026-06-11T16:00:00.000Z")), false);
});
