import { firstMeetingUrlFromText } from "@/server/meetingBots/urls";
import type { ExternalCalendarEvent } from "@/server/meetingBots/calendar";
import type { GoogleCalendarConnection } from "./googleConnectionStore";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export const GOOGLE_CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleCalendarEvent = {
  id?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  hangoutLink?: string;
  visibility?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  creator?: { self?: boolean };
  organizer?: { self?: boolean };
  attendees?: { self?: boolean; responseStatus?: string }[];
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};

type GoogleEventsResponse = {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
};

export function googleCalendarConfigured() {
  return Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID && process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
}

export function googleRedirectUri(origin: string) {
  return process.env.GOOGLE_CALENDAR_REDIRECT_URI ?? `${origin}/api/calendar/google/callback`;
}

export function buildGoogleCalendarAuthUrl(input: { origin: string; state: string }) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  if (!clientId) throw new Error("GOOGLE_CALENDAR_CLIENT_ID is not configured");

  const params = new URLSearchParams({
    access_type: "offline",
    client_id: clientId,
    include_granted_scopes: "true",
    prompt: "consent",
    redirect_uri: googleRedirectUri(input.origin),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    state: input.state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCalendarCode(input: {
  code: string;
  origin: string;
  existingRefreshToken?: string | null;
}): Promise<GoogleCalendarConnection> {
  const tokens = await postGoogleToken({
    code: input.code,
    client_id: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
    grant_type: "authorization_code",
    redirect_uri: googleRedirectUri(input.origin),
  });

  if (!tokens.access_token) {
    throw new Error(tokens.error_description ?? tokens.error ?? "Google did not return an access token");
  }

  const email = await fetchGoogleUserEmail(tokens.access_token);
  const now = new Date().toISOString();
  return {
    email,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? input.existingRefreshToken ?? null,
    expiresAt: expiresAt(tokens.expires_in),
    scope: tokens.scope ?? GOOGLE_CALENDAR_SCOPES.join(" "),
    connectedAt: now,
    updatedAt: now,
    lastSyncedAt: null,
  };
}

export async function refreshGoogleCalendarConnection(connection: GoogleCalendarConnection) {
  if (!connection.refreshToken) throw new Error("Google refresh token is missing; reconnect calendar");
  if (!needsRefresh(connection)) return connection;

  const tokens = await postGoogleToken({
    client_id: requiredEnv("GOOGLE_CALENDAR_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CALENDAR_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
  });

  if (!tokens.access_token) {
    throw new Error(tokens.error_description ?? tokens.error ?? "Google refresh failed");
  }

  return {
    ...connection,
    accessToken: tokens.access_token,
    expiresAt: expiresAt(tokens.expires_in),
    scope: tokens.scope ?? connection.scope,
    updatedAt: new Date().toISOString(),
  };
}

export async function fetchUpcomingGoogleCalendarEvents(input: {
  accessToken: string;
  days?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + (input.days ?? 30) * 24 * 60 * 60_000).toISOString();
  const params = new URLSearchParams({
    maxResults: "2500",
    orderBy: "startTime",
    singleEvents: "true",
    timeMax,
    timeMin,
  });

  const response = await fetch(`${GOOGLE_EVENTS_URL}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  const body = (await response.json()) as GoogleEventsResponse;
  if (!response.ok) throw new Error(body.error?.message ?? `Google Calendar returned ${response.status}`);
  return (body.items ?? []).map(googleEventToExternalCalendarEvent).filter(Boolean) as ExternalCalendarEvent[];
}

export async function createGoogleCalendarEvent(input: {
  accessToken: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  attendees?: string[];
  location?: string | null;
}) {
  const body = {
    summary: input.title,
    description: input.description ?? undefined,
    location: input.location ?? undefined,
    start: { dateTime: new Date(input.startsAt).toISOString() },
    end: { dateTime: new Date(input.endsAt).toISOString() },
    attendees: input.attendees?.filter(Boolean).map((email) => ({ email })),
  };

  const response = await fetch(GOOGLE_EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as GoogleCalendarEvent & { htmlLink?: string; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(result.error?.message ?? `Google Calendar create returned ${response.status}`);
  }
  return {
    id: result.id,
    title: result.summary ?? input.title,
    url: result.htmlLink ?? null,
    startsAt: googleDateToIso(result.start) ?? input.startsAt,
    endsAt: googleDateToIso(result.end) ?? input.endsAt,
  };
}

export function googleCalendarCanWrite(connection: GoogleCalendarConnection) {
  return connection.scope.split(/\s+/).includes(GOOGLE_CALENDAR_WRITE_SCOPE);
}

export function googleEventToExternalCalendarEvent(event: GoogleCalendarEvent): ExternalCalendarEvent | null {
  if (!event.id) return null;
  const startsAt = googleDateToIso(event.start);
  if (!startsAt) return null;

  const conferenceUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video" && entry.uri)?.uri ??
    firstMeetingUrlFromText([event.location, event.description].filter(Boolean).join("\n"));

  return {
    provider: "google",
    externalId: event.id,
    title: event.summary ?? "Untitled meeting",
    description: event.description ?? null,
    location: event.location ?? null,
    conferenceUrl: conferenceUrl ?? null,
    startsAt,
    endsAt: googleDateToIso(event.end),
    responseStatus: googleResponseStatus(event),
    visibility: googleVisibility(event.visibility),
    cancelled: event.status === "cancelled",
  };
}

function googleResponseStatus(event: GoogleCalendarEvent): ExternalCalendarEvent["responseStatus"] {
  const self = event.attendees?.find((attendee) => attendee.self);
  const responseStatus = self?.responseStatus;
  if (responseStatus === "accepted" || responseStatus === "tentative" || responseStatus === "declined") {
    return responseStatus;
  }
  if (responseStatus === "needsAction") return "needs_action";
  if (event.creator?.self || event.organizer?.self) return "accepted";
  return "unknown";
}

function googleVisibility(value: string | undefined): ExternalCalendarEvent["visibility"] {
  if (value === "public" || value === "private" || value === "confidential") return value;
  return "default";
}

function googleDateToIso(value?: { date?: string; dateTime?: string }) {
  if (value?.dateTime) return new Date(value.dateTime).toISOString();
  if (value?.date) return new Date(`${value.date}T00:00:00.000Z`).toISOString();
  return null;
}

async function fetchGoogleUserEmail(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as { email?: string; error?: { message?: string } };
  if (!response.ok || !body.email) {
    throw new Error(body.error?.message ?? "Google did not return an email address");
  }
  return body.email;
}

async function postGoogleToken(params: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return (await response.json()) as GoogleTokenResponse;
}

function expiresAt(expiresInSeconds: number | undefined) {
  if (!expiresInSeconds) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function needsRefresh(connection: GoogleCalendarConnection) {
  if (!connection.expiresAt) return false;
  return new Date(connection.expiresAt).getTime() - Date.now() < 60_000;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
