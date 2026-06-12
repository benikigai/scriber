import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

const meetingSteps = [
  "Sign in to the private Scriber app",
  "Connect Google Calendar or paste a meeting link",
  "Scriber joins Zoom or Google Meet as a visible participant",
  "Approve Linear, Slack, GitHub, or calendar actions before they run",
];

const signals = [
  { label: "Transcript", value: "speaker-aware notes" },
  { label: "Actions", value: "approval-gated tools" },
  { label: "Presence", value: "visible meeting participant" },
  { label: "Memory", value: "Mnemo context whisper" },
];

const appHref = "https://app.usescriber.com/meetings";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.agentConfig) {
    redirect("/meetings");
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#101214] text-[#f7f8f5]">
      <section className="relative min-h-[88svh] border-b border-[#4d63ff]/20">
        <div className="absolute inset-0">
          <Image
            src="/scriber-dashboard-preview.png"
            alt="Scriber meeting dashboard with transcript and approval controls"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-[0.38] saturate-[0.72] brightness-[0.8] contrast-[1.12]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,18,20,0.98)_0%,rgba(16,18,20,0.9)_34%,rgba(16,18,20,0.55)_70%,rgba(16,18,20,0.84)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,18,20,0.12)_0%,rgba(25,29,35,0.18)_44%,rgba(16,18,20,0.94)_100%)]" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(77,99,255,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,106,77,0.1)_1px,transparent_1px)] [background-size:72px_72px]" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="font-sans text-2xl font-semibold tracking-normal">
            Scriber
          </Link>
          <div className="flex items-center gap-5 text-sm text-[#c7ccd4]/75">
            <Link href="#how-it-works" className="hover:text-[#f7f8f5]">
              How it works
            </Link>
            <a href={appHref} className="hover:text-[#f7f8f5]">
              Sign in
            </a>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 pb-16 pt-[12svh]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#ff7a5c]">
            usescriber.com
          </p>
          <h1 className="mt-5 max-w-4xl font-sans text-7xl font-semibold leading-[0.9] tracking-normal sm:text-8xl md:text-9xl lg:text-[10rem]">
            Scriber
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-[#d9dde5]/80 md:text-2xl md:leading-9">
            A meeting agent that joins the call, listens for decisions, responds when invited, and keeps the work moving without pretending the meeting is the work.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <a
              href={appHref}
              className="rounded-full bg-[#4d63ff] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#384de0]"
            >
              Open Scriber
            </a>
            <Link
              href="#how-it-works"
              className="rounded-full border border-[#d9dde5]/30 px-6 py-3 text-sm font-medium text-[#f7f8f5] transition hover:border-[#ff7a5c] hover:text-[#ff7a5c]"
            >
              See how it works
            </Link>
          </div>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-3 px-6 pb-8 sm:grid-cols-2 md:grid-cols-4">
          {signals.map((signal) => (
            <div key={signal.label} className="border-t border-[#4d63ff]/20 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#ff7a5c]/75">
                {signal.label}
              </div>
              <div className="mt-2 text-sm text-[#d9dde5]/80">{signal.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#f2f4f0] px-6 py-20 text-[#101214]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.86fr_1.14fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#4d63ff]">
              From calendar to call
            </p>
            <h2 className="mt-4 max-w-xl font-sans text-5xl font-semibold leading-[0.94] tracking-normal md:text-7xl">
              Start with sign-in. Connect calendar inside the app.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {meetingSteps.map((step, index) => (
              <div key={step} className="border border-[#20252c]/10 bg-white/75 p-5 shadow-[0_20px_70px_rgba(16,18,20,0.08)]">
                <div className="font-mono text-xs text-[#4d63ff]">0{index + 1}</div>
                <div className="mt-8 text-xl leading-7">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#4d63ff]/20 bg-[#191d23] px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#f4b740]">
              Meeting runtime
            </p>
            <h2 className="mt-4 font-sans text-5xl font-semibold leading-[0.95] tracking-normal md:text-7xl">
              Quiet by default. Useful on purpose.
            </h2>
          </div>
          <div className="self-end text-lg leading-8 text-[#d9dde5]/75">
            Scriber is a visible Zoom and Google Meet participant with realtime voice, normalized transcripts, screen-share capture, and approval-first tool use. Calendar connection, manual meeting links, and workspace tools all live in the private app.
          </div>
        </div>
      </section>
    </main>
  );
}
