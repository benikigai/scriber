import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  authConfigured,
  authCookieValue,
  safeRedirectPath,
} from "@/lib/authGate";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const next = safeRedirectPath(form.get("next"));

  if (!authConfigured()) {
    return NextResponse.redirect(new URL(`/login?configured=0&next=${encodeURIComponent(next)}`, req.url));
  }

  if (password !== process.env.SCRIBER_ACCESS_PASSWORD) {
    return NextResponse.redirect(new URL(`/login?error=1&next=${encodeURIComponent(next)}`, req.url));
  }

  const cookieValue = await authCookieValue();
  if (!cookieValue) {
    return NextResponse.redirect(new URL(`/login?configured=0&next=${encodeURIComponent(next)}`, req.url));
  }

  const response = NextResponse.redirect(new URL(next, req.url));
  response.cookies.set(AUTH_COOKIE, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
