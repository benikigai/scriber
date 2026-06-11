import type { NextRequest } from "next/server";

type RequestWithOrigin = Pick<NextRequest, "headers" | "nextUrl">;

export function publicAppOrigin(req: RequestWithOrigin) {
  const configuredOrigin = normalizeConfiguredOrigin(
    process.env.SCRIBER_PUBLIC_ORIGIN ?? process.env.SCRIBER_WEB_ORIGIN ?? process.env.SCRIBER_DOMAIN,
  );
  if (configuredOrigin) return configuredOrigin;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(/:$/, "") ?? "https";
  return `${proto}://${host}`;
}

export function publicAppUrl(path: string, req: RequestWithOrigin) {
  return new URL(path, publicAppOrigin(req));
}

export function isPublicAppSecure(req: RequestWithOrigin) {
  return publicAppOrigin(req).startsWith("https://");
}

function normalizeConfiguredOrigin(value?: string) {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `https://${trimmed}`;
}
