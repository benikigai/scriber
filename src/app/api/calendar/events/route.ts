import { NextRequest, NextResponse } from "next/server";
import { type ExternalCalendarEvent } from "@/server/meetingBots/calendar";
import { syncExternalCalendarEvents } from "@/server/meetingBots/calendarSync";
import { listCalendarEvents } from "@/server/meetingBots/store";

export async function GET() {
  return NextResponse.json({ events: listCalendarEvents() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inputs = Array.isArray(body.events) ? (body.events as ExternalCalendarEvent[]) : [];
    return NextResponse.json(syncExternalCalendarEvents(inputs));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "calendar sync failed" }, { status: 400 });
  }
}
