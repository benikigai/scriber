import { NextResponse } from "next/server";
import { clearGoogleCalendarConnection } from "@/server/calendar/googleConnectionStore";

export async function POST() {
  clearGoogleCalendarConnection();
  return NextResponse.json({ ok: true });
}
