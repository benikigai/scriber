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
    <main className="min-h-screen bg-[#0b100f] px-6 py-8 text-[#f5efe3]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <Link href="/" className="font-serif text-3xl tracking-tight">
          Scriber
        </Link>
        <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-[#8bd3c7]">
          Personal console
        </p>
        <h1 className="mt-4 font-serif text-6xl leading-[0.92] tracking-[-0.05em]">
          Private runtime access.
        </h1>
        <p className="mt-5 text-lg leading-7 text-[#eee4d2]/70">
          The public landing page is open. Meeting bots, Realtime sessions, and tool APIs are password-gated.
        </p>

        <form action="/api/auth/login" method="post" className="mt-8 space-y-3">
          <input type="hidden" name="next" value={next} />
          <label className="block">
            <span className="mb-2 block text-sm text-[#eee4d2]/70">Password</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="w-full border border-white/15 bg-white/[0.06] px-4 py-3 text-base text-[#f5efe3] outline-none transition placeholder:text-[#eee4d2]/30 focus:border-[#8bd3c7]"
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
          <button className="w-full rounded-full bg-[#f5efe3] px-6 py-3 text-sm font-medium text-[#0b100f] transition hover:bg-[#d7f4ee]">
            Unlock Scriber
          </button>
        </form>
      </div>
    </main>
  );
}
