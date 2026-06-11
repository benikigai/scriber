import { NextResponse } from "next/server";
import { googleCalendarConfigured, GOOGLE_CALENDAR_SCOPES } from "@/server/calendar/google";
import { getGoogleCalendarConnection } from "@/server/calendar/googleConnectionStore";

export async function GET() {
  const connection = getGoogleCalendarConnection();
  return NextResponse.json({
    configured: googleCalendarConfigured(),
    connected: Boolean(connection),
    email: connection?.email ?? null,
    expiresAt: connection?.expiresAt ?? null,
    lastSyncedAt: connection?.lastSyncedAt ?? null,
    scopes: connection?.scope?.split(/\s+/).filter(Boolean) ?? GOOGLE_CALENDAR_SCOPES,
  });
}
