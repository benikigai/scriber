import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  authConfigured,
  authCookieValue,
  safeRedirectPath,
} from "@/lib/authGate";
import { publicAppUrl } from "@/lib/publicOrigin";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = safeRedirectPath(form.get("next"));

  if (!authConfigured()) {
    return NextResponse.redirect(publicAppUrl(`/login?configured=0&next=${encodeURIComponent(next)}`, req));
  }

  if (password !== process.env.SCRIBER_ACCESS_PASSWORD) {
    return NextResponse.redirect(publicAppUrl(`/login?error=1&next=${encodeURIComponent(next)}`, req));
  }

  const cookieValue = await authCookieValue();
  if (!cookieValue) {
    return NextResponse.redirect(publicAppUrl(`/login?configured=0&next=${encodeURIComponent(next)}`, req));
  }

  const response = NextResponse.redirect(publicAppUrl(next, req));
  response.cookies.set(AUTH_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
