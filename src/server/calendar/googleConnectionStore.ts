import fs from "fs";
import path from "path";

export type GoogleCalendarConnection = {
  email: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string;
  connectedAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
};

const GOOGLE_CONNECTION_SYMBOL = Symbol.for("scriber.googleCalendarConnection");

function connectionFilePath() {
  if (process.env.SCRIBER_GOOGLE_CALENDAR_FILE) return process.env.SCRIBER_GOOGLE_CALENDAR_FILE;
  if (process.env.SCRIBER_DATA_DIR) return path.join(process.env.SCRIBER_DATA_DIR, "google-calendar.json");
  return null;
}

function loadConnectionFromDisk() {
  const filePath = connectionFilePath();
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as GoogleCalendarConnection;
  } catch (error: any) {
    console.warn(`[scriber/google-calendar] failed to read ${filePath}: ${error?.message ?? error}`);
    return null;
  }
}

function writeConnectionToDisk(connection: GoogleCalendarConnection | null) {
  const filePath = connectionFilePath();
  if (!filePath) return;

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!connection) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return;
    }
    const tempPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(connection, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  } catch (error: any) {
    console.warn(`[scriber/google-calendar] failed to persist connection: ${error?.message ?? error}`);
  }
}

export function getGoogleCalendarConnection() {
  const globalStore = globalThis as unknown as Record<symbol, GoogleCalendarConnection | null | undefined>;
  if (globalStore[GOOGLE_CONNECTION_SYMBOL] === undefined) {
    globalStore[GOOGLE_CONNECTION_SYMBOL] = loadConnectionFromDisk();
  }
  return globalStore[GOOGLE_CONNECTION_SYMBOL] ?? null;
}

export function saveGoogleCalendarConnection(connection: GoogleCalendarConnection) {
  const globalStore = globalThis as unknown as Record<symbol, GoogleCalendarConnection | null | undefined>;
  globalStore[GOOGLE_CONNECTION_SYMBOL] = connection;
  writeConnectionToDisk(connection);
  return connection;
}

export function clearGoogleCalendarConnection() {
  const globalStore = globalThis as unknown as Record<symbol, GoogleCalendarConnection | null | undefined>;
  globalStore[GOOGLE_CONNECTION_SYMBOL] = null;
  writeConnectionToDisk(null);
}
