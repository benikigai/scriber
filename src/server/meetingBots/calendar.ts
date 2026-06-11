import type { CalendarEventRecord, CalendarProvider, CreateMeetingBotInput } from "./types";
import { assertSupportedMeetingUrl, firstMeetingUrlFromText } from "./urls";

export type ExternalCalendarEvent = {
  provider: CalendarProvider;
  externalId: string;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  conferenceUrl?: string | null;
  startsAt: string;
  endsAt?: string | null;
  responseStatus?: CalendarEventRecord["responseStatus"];
  visibility?: CalendarEventRecord["visibility"];
  cancelled?: boolean;
};

export function normalizeCalendarEvent(event: ExternalCalendarEvent): CalendarEventRecord | null {
  const meetingUrl =
    event.conferenceUrl ??
    firstMeetingUrlFromText([event.location, event.description].filter(Boolean).join("\n"));
  if (!meetingUrl) return null;

  const platform = assertSupportedMeetingUrl(meetingUrl);
  const now = new Date().toISOString();

  return {
    id: `${event.provider}:${event.externalId}`,
    provider: event.provider,
    externalId: event.externalId,
    title: event.title?.trim() || "Untitled meeting",
    meetingUrl,
    platform,
    startsAt: new Date(event.startsAt).toISOString(),
    endsAt: event.endsAt ? new Date(event.endsAt).toISOString() : null,
    responseStatus: event.responseStatus ?? "unknown",
    visibility: event.visibility ?? "default",
    cancelled: Boolean(event.cancelled),
    scheduledBotId: null,
    updatedAt: now,
  };
}

export function shouldAutoScheduleCalendarEvent(event: CalendarEventRecord, now = new Date()) {
  if (event.cancelled) return false;
  if (event.visibility === "private" || event.visibility === "confidential") return false;
  if (event.responseStatus === "declined") return false;
  return new Date(event.startsAt).getTime() > now.getTime();
}

export function joinAtForCalendarEvent(event: CalendarEventRecord, leadMinutes = 2) {
  return new Date(new Date(event.startsAt).getTime() - leadMinutes * 60_000).toISOString();
}

export function calendarEventToMeetingBotInput(event: CalendarEventRecord): CreateMeetingBotInput {
  return {
    meetingUrl: event.meetingUrl,
    title: event.title,
    joinAt: joinAtForCalendarEvent(event),
    botName: "Scriber",
    wakeMode: "wake",
  };
}
