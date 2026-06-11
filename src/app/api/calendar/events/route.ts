import { NextRequest, NextResponse } from "next/server";
import {
  calendarEventToMeetingBotInput,
  normalizeCalendarEvent,
  shouldAutoScheduleCalendarEvent,
  type ExternalCalendarEvent,
} from "@/server/meetingBots/calendar";
import {
  createMeetingBot,
  listCalendarEvents,
  upsertCalendarEvent,
} from "@/server/meetingBots/store";

export async function GET() {
  return NextResponse.json({ events: listCalendarEvents() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inputs = Array.isArray(body.events) ? (body.events as ExternalCalendarEvent[]) : [];
    const prior = new Map(listCalendarEvents().map((event) => [event.id, event]));
    const synced = [];
    const scheduled = [];

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

      synced.push(upsertCalendarEvent(normalized));
    }

    return NextResponse.json({ events: synced, scheduled });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "calendar sync failed" }, { status: 400 });
  }
}
