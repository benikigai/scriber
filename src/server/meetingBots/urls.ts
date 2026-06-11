import type { MeetingPlatform } from "./types";

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/gi;

export function detectMeetingPlatform(meetingUrl: string): MeetingPlatform | null {
  try {
    const parsed = new URL(meetingUrl);
    const host = parsed.hostname.toLowerCase();
    if (host === "meet.google.com" || host.endsWith(".meet.google.com")) {
      return "google_meet";
    }
    if (host === "zoom.us" || host.endsWith(".zoom.us")) {
      return "zoom";
    }
    return null;
  } catch {
    return null;
  }
}

export function assertSupportedMeetingUrl(meetingUrl: string): MeetingPlatform {
  const platform = detectMeetingPlatform(meetingUrl);
  if (!platform) {
    throw new Error("meetingUrl must be a Zoom or Google Meet URL");
  }
  return platform;
}

export function extractMeetingUrls(text: string): string[] {
  const candidates = text.match(URL_PATTERN) ?? [];
  const normalized = candidates
    .map((candidate) => candidate.replace(/[.,;:!?]+$/g, ""))
    .filter((candidate) => detectMeetingPlatform(candidate));
  return Array.from(new Set(normalized));
}

export function firstMeetingUrlFromText(text: string): string | null {
  return extractMeetingUrls(text)[0] ?? null;
}

export function meetingPlatformLabel(platform: MeetingPlatform) {
  return platform === "google_meet" ? "Google Meet" : "Zoom";
}
