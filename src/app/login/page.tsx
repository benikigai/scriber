import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "/meetings";
  const hasError = params.error === "1";
  const missingConfig = params.configured === "0";

  return (
    <main className="min-h-screen bg-[#071014] px-6 py-8 text-[#f2fbff]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <Link href="/" className="font-serif text-3xl tracking-tight">
          Scriber
        </Link>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-[#91e7ff]">
          Personal console
        </p>
        <h1 className="mt-4 font-serif text-6xl leading-[0.92] tracking-[-0.05em]">
          Private runtime access.
        </h1>
        <p className="mt-5 text-lg leading-7 text-[#d9eff8]/70">
          The public landing page is open. Meeting bots, Realtime sessions, and tool APIs are password-gated.
        </p>

        <form action="/api/auth/login" method="post" className="mt-8 space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="mb-2 block text-sm text-[#d9eff8]/70">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full border border-[#91e7ff]/20 bg-white/[0.06] px-4 py-3 text-base text-[#f2fbff] outline-none transition placeholder:text-[#d9eff8]/30 focus:border-[#baff6f]"
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
          <button className="w-full rounded-full bg-[#baff6f] px-6 py-3 text-sm font-medium text-[#071014] transition hover:bg-[#91e7ff]">
            Unlock Scriber
          </button>
        </form>
      </div>
    </main>
  );
}
