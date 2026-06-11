import {
  calendarEventToMeetingBotInput,
  normalizeCalendarEvent,
  shouldAutoScheduleCalendarEvent,
  type ExternalCalendarEvent,
} from "./calendar";
import {
  createMeetingBot,
  listCalendarEvents,
  upsertCalendarEvent,
} from "./store";
import type { CalendarEventRecord, MeetingBotRecord } from "./types";

export type CalendarSyncResult = {
  events: CalendarEventRecord[];
  scheduled: MeetingBotRecord[];
};

export function syncExternalCalendarEvents(inputs: ExternalCalendarEvent[]): CalendarSyncResult {
  const prior = new Map(listCalendarEvents().map((event) => [event.id, event]));
  const events: CalendarEventRecord[] = [];
  const scheduled: MeetingBotRecord[] = [];

  for (const input of inputs) {
    const normalized = normalizeCalendarEvent(input);
    if (!normalized) continue;

    const existing = prior.get(normalized.id);
    normalized.scheduledBotId = existing?.scheduledBotId ?? null;

    if (!normalized.scheduledBotId && shouldAutoScheduleCalendarEvent(normalized)) {
      const bot = createMeetingBot(calendarEventToMeetingBotInput(normalized));
      normalized.scheduledBotId = bot.id;
      scheduled.push(bot);
    }

    events.push(upsertCalendarEvent(normalized));
  }

  return { events, scheduled };
}
