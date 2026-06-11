import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

const meetingSteps = [
  "Joins Zoom and Google Meet as Scriber",
  "Listens for names, decisions, blockers, and action items",
  "Speaks only when addressed or woken from the console",
  "Queues Linear and Slack writes for approval",
];

const signals = [
  { label: "Transcript", value: "speaker-aware notes" },
  { label: "Actions", value: "approval-gated tools" },
  { label: "Presence", value: "visible meeting participant" },
  { label: "Memory", value: "Mnemo context whisper" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.agentConfig) {
    redirect(`/console?agentConfig=${encodeURIComponent(String(params.agentConfig))}`);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#071014] text-[#f2fbff]">
      <section className="relative min-h-[88svh] border-b border-[#91e7ff]/20">
        <div className="absolute inset-0">
          <Image
            src="/scriber-dashboard-preview.png"
            alt="Scriber meeting dashboard with transcript and approval controls"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-[0.4] saturate-[1.25] brightness-[0.82] contrast-[1.08]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,16,20,0.98)_0%,rgba(7,16,20,0.9)_34%,rgba(7,16,20,0.5)_70%,rgba(7,16,20,0.8)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,16,20,0.16)_0%,rgba(16,28,38,0.14)_44%,rgba(7,16,20,0.94)_100%)]" />
          <div className="absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(145,231,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(186,255,111,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="font-serif text-2xl tracking-tight">
            Scriber
          </Link>
          <div className="flex items-center gap-5 text-sm text-[#b7d7e8]/70">
            <Link href="/meetings" className="hover:text-[#f2fbff]">
              Runtime
            </Link>
            <Link href="/console?agentConfig=scriber" className="hover:text-[#f2fbff]">
              Console
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 pb-16 pt-[12svh]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#91e7ff]">
            usescriber.com
          </p>
          <h1 className="mt-5 max-w-4xl font-serif text-[clamp(4rem,12vw,10.5rem)] font-normal leading-[0.86] tracking-[-0.055em]">
            Scriber
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-[#d9eff8]/80 md:text-2xl md:leading-9">
            A meeting agent that joins the call, listens for decisions, responds when invited, and keeps the work moving without pretending the meeting is the work.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/meetings"
              className="rounded-full bg-[#baff6f] px-6 py-3 text-sm font-medium text-[#071014] transition hover:bg-[#91e7ff]"
            >
              Review runtime
            </Link>
            <Link
              href="/console?agentConfig=scriber"
              className="rounded-full border border-[#91e7ff]/30 px-6 py-3 text-sm font-medium text-[#f2fbff] transition hover:border-[#baff6f] hover:text-[#baff6f]"
            >
              Open console
            </Link>
          </div>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-2 gap-px px-6 pb-8 md:grid-cols-4">
          {signals.map((signal) => (
            <div key={signal.label} className="border-t border-[#91e7ff]/20 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#91e7ff]/70">
                {signal.label}
              </div>
              <div className="mt-2 text-sm text-[#d9eff8]/80">{signal.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#eaf8ff] px-6 py-20 text-[#071014]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.86fr_1.14fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#14627c]">
              Built for live calls
            </p>
            <h2 className="mt-4 max-w-xl font-serif text-5xl leading-[0.94] tracking-[-0.045em] md:text-7xl">
              The teammate who remembers the meeting.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {meetingSteps.map((step, index) => (
              <div key={step} className="border border-[#14627c]/20 bg-white/70 p-5 shadow-[0_20px_70px_rgba(7,16,20,0.08)]">
                <div className="font-mono text-xs text-[#14627c]">0{index + 1}</div>
                <div className="mt-8 text-xl leading-7">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#91e7ff]/20 bg-[#101923] px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#ffd166]">
              Placeholder while the runtime hardens
            </p>
            <h2 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.045em] md:text-7xl">
              Quiet by default. Useful on purpose.
            </h2>
          </div>
          <div className="self-end text-lg leading-8 text-[#d9eff8]/75">
            Scriber is being built as a visible Zoom and Google Meet participant with realtime voice, normalized transcripts, screen-share capture, and approval-first tool use. The public site will grow from here as the runtime becomes something teams can invite into real calls.
          </div>
        </div>
      </section>
    </main>
  );
}
