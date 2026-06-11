import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleCalendarAuthUrl,
  googleCalendarConfigured,
} from "@/server/calendar/google";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/server/calendar/oauthState";

export async function GET(req: NextRequest) {
  if (!googleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/meetings?calendar=config", req.url));
  }

  const state = randomUUID();
  const response = NextResponse.redirect(
    buildGoogleCalendarAuthUrl({
      origin: req.nextUrl.origin,
      state,
    }),
  );
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
  });
  return response;
}
