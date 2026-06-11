export const AUTH_COOKIE = "scriber_auth";

const PROTECTED_PREFIXES = [
  "/console",
  "/meetings",
  "/api/calendar",
  "/api/meeting-bots",
  "/api/responses",
  "/api/session",
  "/api/tool-proposals",
  "/api/tools",
  "/api/whispers",
];

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function authConfigured() {
  return Boolean(process.env.SCRIBER_ACCESS_PASSWORD);
}

export async function authCookieValue() {
  const password = process.env.SCRIBER_ACCESS_PASSWORD;
  if (!password) return null;
  const secret = process.env.SCRIBER_AUTH_SECRET ?? password;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`scriber:${password}:${secret}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidAuthCookie(value?: string | null) {
  const expected = await authCookieValue();
  if (!expected || !value || value.length !== expected.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ value.charCodeAt(index);
  }
  return mismatch === 0;
}

export function isValidInternalApiToken(value?: string | null) {
  const expected = process.env.SCRIBER_INTERNAL_API_TOKEN;
  if (!expected || !value) return false;
  return value === expected;
}

export function bearerToken(value?: string | null) {
  if (value?.toLowerCase().startsWith("bearer ")) return value.slice("bearer ".length).trim();
  return null;
}

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined) {
  const path = typeof value === "string" ? value : "/meetings";
  if (!path.startsWith("/") || path.startsWith("//")) return "/meetings";
  if (path.startsWith("/login")) return "/meetings";
  return path;
}
