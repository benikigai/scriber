import Link from "next/link";
import { safeRedirectPath } from "@/lib/authGate";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(typeof params.next === "string" ? params.next : undefined);
  const hasError = params.error === "1";
  const missingConfig = params.configured === "0";

  return (
    <main className="min-h-screen bg-[#101214] px-6 py-8 text-[#f7f8f5]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <Link href="/" className="font-sans text-3xl font-semibold tracking-normal">
          Scriber
        </Link>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-[#ff7a5c]">
          Personal console
        </p>
        <h1 className="mt-4 font-sans text-6xl font-semibold leading-[0.92] tracking-normal">
          Private runtime access.
        </h1>
        <p className="mt-5 text-lg leading-7 text-[#d9dde5]/70">
          The public landing page is open. Meeting bots, Realtime sessions, and tool APIs are password-gated.
        </p>

        <form action="/api/auth/login" method="post" className="mt-8 space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="mb-2 block text-sm text-[#d9dde5]/70">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full border border-[#4d63ff]/25 bg-white/[0.06] px-4 py-3 text-base text-[#f7f8f5] outline-none transition placeholder:text-[#d9dde5]/30 focus:border-[#ff7a5c]"
              placeholder="Enter access password"
            />
          </label>
          {hasError ? (
            <div className="border border-red-300/25 bg-red-950/30 px-4 py-3 text-sm text-red-100">
              That password did not match.
            </div>
          ) : null}
          {missingConfig ? (
            <div className="border border-amber-300/25 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
              SCRIBER_ACCESS_PASSWORD is not configured on this deployment.
            </div>
          ) : null}
          <button className="w-full rounded-full bg-[#4d63ff] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#384de0]">
            Unlock Scriber
          </button>
        </form>
      </div>
    </main>
  );
}
