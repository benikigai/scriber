import assert from "node:assert/strict";
import test from "node:test";
import { googleEventToExternalCalendarEvent } from "../src/server/calendar/google";

test("maps Google Meet event into external calendar event", () => {
  const event = googleEventToExternalCalendarEvent({
    id: "abc123",
    summary: "Design review",
    hangoutLink: "https://meet.google.com/aaa-bbbb-ccc",
    start: { dateTime: "2026-06-12T10:00:00-07:00" },
    end: { dateTime: "2026-06-12T10:30:00-07:00" },
    attendees: [{ self: true, responseStatus: "accepted" }],
  });

  assert.equal(event?.provider, "google");
  assert.equal(event?.externalId, "abc123");
  assert.equal(event?.conferenceUrl, "https://meet.google.com/aaa-bbbb-ccc");
  assert.equal(event?.responseStatus, "accepted");
  assert.equal(event?.startsAt, "2026-06-12T17:00:00.000Z");
});

test("extracts Zoom URL from Google Calendar description", () => {
  const event = googleEventToExternalCalendarEvent({
    id: "zoom123",
    summary: "Customer call",
    description: "Join here: https://zoom.us/j/123456789?pwd=abc",
    start: { dateTime: "2026-06-12T14:00:00Z" },
    attendees: [{ self: true, responseStatus: "tentative" }],
  });

  assert.equal(event?.conferenceUrl, "https://zoom.us/j/123456789?pwd=abc");
  assert.equal(event?.responseStatus, "tentative");
});

test("maps Google declined and private fields", () => {
  const event = googleEventToExternalCalendarEvent({
    id: "private123",
    summary: "Private sync",
    hangoutLink: "https://meet.google.com/ddd-eeee-fff",
    start: { dateTime: "2026-06-12T14:00:00Z" },
    visibility: "private",
    attendees: [{ self: true, responseStatus: "declined" }],
  });

  assert.equal(event?.visibility, "private");
  assert.equal(event?.responseStatus, "declined");
});
