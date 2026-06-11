import { NextRequest, NextResponse } from "next/server";
import { syncConnectedGoogleCalendar } from "@/server/calendar/googleSync";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const days = Number.isFinite(Number(body.days)) ? Number(body.days) : 30;
    const result = await syncConnectedGoogleCalendar(Math.min(Math.max(days, 1), 90));
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Google Calendar sync failed" }, { status: 400 });
  }
}
