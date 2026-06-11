import {
  fetchUpcomingGoogleCalendarEvents,
  googleCalendarConfigured,
  refreshGoogleCalendarConnection,
} from "./google";
import {
  getGoogleCalendarConnection,
  saveGoogleCalendarConnection,
} from "./googleConnectionStore";
import { syncExternalCalendarEvents } from "@/server/meetingBots/calendarSync";

export async function syncConnectedGoogleCalendar(days = 30) {
  if (!googleCalendarConfigured()) throw new Error("Google Calendar OAuth is not configured");

  const existing = getGoogleCalendarConnection();
  if (!existing) throw new Error("Google Calendar is not connected");

  const refreshed = await refreshGoogleCalendarConnection(existing);
  const externalEvents = await fetchUpcomingGoogleCalendarEvents({
    accessToken: refreshed.accessToken,
    days,
  });
  const result = syncExternalCalendarEvents(externalEvents);

  saveGoogleCalendarConnection({
    ...refreshed,
    lastSyncedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  return {
    ...result,
    account: {
      email: refreshed.email,
      lastSyncedAt: new Date().toISOString(),
    },
  };
}
