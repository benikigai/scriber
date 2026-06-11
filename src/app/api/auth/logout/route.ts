import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/authGate";
import { publicAppUrl } from "@/lib/publicOrigin";

export async function POST(req: NextRequest) {
  const response = NextResponse.redirect(publicAppUrl("/", req));
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
