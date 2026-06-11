import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildGoogleCalendarAuthUrl,
  googleCalendarConfigured,
} from "@/server/calendar/google";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/server/calendar/oauthState";
import { isPublicAppSecure, publicAppOrigin, publicAppUrl } from "@/lib/publicOrigin";

export async function GET(req: NextRequest) {
  if (!googleCalendarConfigured()) {
    return NextResponse.redirect(publicAppUrl("/meetings?calendar=config", req));
  }

  const state = randomUUID();
  const origin = publicAppOrigin(req);
  const response = NextResponse.redirect(
    buildGoogleCalendarAuthUrl({
      origin,
      state,
    }),
  );
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax",
    secure: isPublicAppSecure(req),
  });
  return response;
}
