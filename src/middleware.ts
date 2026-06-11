import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  bearerToken,
  isProtectedPath,
  isValidAuthCookie,
  isValidInternalApiToken,
} from "@/lib/authGate";

const MARKETING_HOSTS = new Set(["usescriber.com", "www.usescriber.com"]);

export async function middleware(req: NextRequest) {
  const runtimeRedirect = runtimeHostRedirect(req);
  if (runtimeRedirect) return runtimeRedirect;

  if (!isProtectedPath(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (
    req.nextUrl.pathname.startsWith("/api/") &&
    isValidInternalApiToken(bearerToken(req.headers.get("authorization")))
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (await isValidAuthCookie(cookie)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

function runtimeHostRedirect(req: NextRequest) {
  const host = req.nextUrl.hostname;
  if (!MARKETING_HOSTS.has(host)) return null;
  if (!isRuntimePath(req.nextUrl.pathname)) return null;

  const runtimeOrigin = (process.env.SCRIBER_RUNTIME_ORIGIN ?? "https://app.usescriber.com").replace(/\/+$/, "");
  const url = new URL(`${req.nextUrl.pathname}${req.nextUrl.search}`, runtimeOrigin);
  if (url.hostname === host) return null;
  return NextResponse.redirect(url);
}

function isRuntimePath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/meetings" ||
    pathname === "/console" ||
    pathname.startsWith("/api/")
  );
}
