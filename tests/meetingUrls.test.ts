import assert from "node:assert/strict";
import test from "node:test";
import {
  detectMeetingPlatform,
  extractMeetingUrls,
} from "../src/server/meetingBots/urls";

test("detects Zoom and Google Meet URLs", () => {
  assert.equal(detectMeetingPlatform("https://benikigai.zoom.us/j/123456789"), "zoom");
  assert.equal(detectMeetingPlatform("https://meet.google.com/abc-defg-hij"), "google_meet");
  assert.equal(detectMeetingPlatform("https://example.com/call"), null);
});

test("extracts supported meeting URLs from calendar text", () => {
  const urls = extractMeetingUrls(
    "Join https://meet.google.com/abc-defg-hij or backup https://foo.zoom.us/j/987654321.",
  );
  assert.deepEqual(urls, [
    "https://meet.google.com/abc-defg-hij",
    "https://foo.zoom.us/j/987654321",
  ]);
});
