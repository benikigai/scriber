import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCalendarCode } from "@/server/calendar/google";
import {
  getGoogleCalendarConnection,
  saveGoogleCalendarConnection,
} from "@/server/calendar/googleConnectionStore";
import { syncConnectedGoogleCalendar } from "@/server/calendar/googleSync";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/server/calendar/oauthState";

export async function GET(req: NextRequest) {
  const redirectUrl = new URL("/meetings", req.url);
  const error = req.nextUrl.searchParams.get("error");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;

  if (error) {
    redirectUrl.searchParams.set("calendar", "error");
    redirectUrl.searchParams.set("detail", error);
    return redirectWithClearedState(redirectUrl, req);
  }

  if (!code || !state || state !== expectedState) {
    redirectUrl.searchParams.set("calendar", "error");
    redirectUrl.searchParams.set("detail", "state");
    return redirectWithClearedState(redirectUrl, req);
  }

  try {
    const existing = getGoogleCalendarConnection();
    const connection = await exchangeGoogleCalendarCode({
      code,
      existingRefreshToken: existing?.refreshToken,
      origin: req.nextUrl.origin,
    });
    saveGoogleCalendarConnection(connection);
    const result = await syncConnectedGoogleCalendar();

    redirectUrl.searchParams.set("calendar", "connected");
    redirectUrl.searchParams.set("scheduled", String(result.scheduled.length));
    return redirectWithClearedState(redirectUrl, req);
  } catch (callbackError: any) {
    redirectUrl.searchParams.set("calendar", "error");
    redirectUrl.searchParams.set("detail", callbackError?.message ?? "callback");
    return redirectWithClearedState(redirectUrl, req);
  }
}

function redirectWithClearedState(url: URL, req: NextRequest) {
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
  });
  return response;
}
