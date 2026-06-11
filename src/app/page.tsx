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
    <main className="min-h-screen overflow-x-hidden bg-[#0b100f] text-[#f5efe3]">
      <section className="relative min-h-[88svh] border-b border-white/10">
        <div className="absolute inset-0">
          <Image
            src="/scriber-dashboard-preview.png"
            alt="Scriber meeting dashboard with transcript and approval controls"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center opacity-[0.36] saturate-[0.85]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,16,15,0.96)_0%,rgba(11,16,15,0.86)_36%,rgba(11,16,15,0.42)_72%,rgba(11,16,15,0.74)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,16,15,0.28)_0%,rgba(11,16,15,0.10)_45%,rgba(11,16,15,0.92)_100%)]" />
          <div className="absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(245,239,227,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(245,239,227,0.12)_1px,transparent_1px)] [background-size:72px_72px]" />
        </div>

        <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          <Link href="/" className="font-serif text-2xl tracking-tight">
            Scriber
          </Link>
          <div className="flex items-center gap-5 text-sm text-[#d9d0bf]/70">
            <Link href="/meetings" className="hover:text-[#f5efe3]">
              Runtime
            </Link>
            <Link href="/console?agentConfig=scriber" className="hover:text-[#f5efe3]">
              Console
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex max-w-7xl flex-col px-6 pb-16 pt-[12svh]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-[#8bd3c7]">
            usescriber.com
          </p>
          <h1 className="mt-5 max-w-4xl font-serif text-[clamp(4rem,12vw,10.5rem)] font-normal leading-[0.86] tracking-[-0.055em]">
            Scriber
          </h1>
          <p className="mt-7 max-w-2xl text-xl leading-8 text-[#eee4d2]/80 md:text-2xl md:leading-9">
            A meeting agent that joins the call, listens for decisions, responds when invited, and keeps the work moving without pretending the meeting is the work.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/meetings"
              className="rounded-full bg-[#f5efe3] px-6 py-3 text-sm font-medium text-[#0b100f] transition hover:bg-[#d7f4ee]"
            >
              Review runtime
            </Link>
            <Link
              href="/console?agentConfig=scriber"
              className="rounded-full border border-[#f5efe3]/30 px-6 py-3 text-sm font-medium text-[#f5efe3] transition hover:border-[#8bd3c7] hover:text-[#8bd3c7]"
            >
              Open console
            </Link>
          </div>
        </div>

        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-2 gap-px px-6 pb-8 md:grid-cols-4">
          {signals.map((signal) => (
            <div key={signal.label} className="border-t border-white/10 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8bd3c7]/70">
                {signal.label}
              </div>
              <div className="mt-2 text-sm text-[#f5efe3]/80">{signal.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#f5efe3] px-6 py-20 text-[#121614]">
        <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.86fr_1.14fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#3d796f]">
              Built for live calls
            </p>
            <h2 className="mt-4 max-w-xl font-serif text-5xl leading-[0.94] tracking-[-0.045em] md:text-7xl">
              The teammate who remembers the meeting.
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {meetingSteps.map((step, index) => (
              <div key={step} className="border border-[#121614]/10 bg-white/[0.38] p-5">
                <div className="font-mono text-xs text-[#3d796f]">0{index + 1}</div>
                <div className="mt-8 text-xl leading-7">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0b100f] px-6 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-[#c6a46c]">
              Placeholder while the runtime hardens
            </p>
            <h2 className="mt-4 font-serif text-5xl leading-[0.95] tracking-[-0.045em] md:text-7xl">
              Quiet by default. Useful on purpose.
            </h2>
          </div>
          <div className="self-end text-lg leading-8 text-[#eee4d2]/72">
            Scriber is being built as a visible Zoom and Google Meet participant with realtime voice, normalized transcripts, screen-share capture, and approval-first tool use. The public site will grow from here as the runtime becomes something teams can invite into real calls.
          </div>
        </div>
      </section>
    </main>
  );
}
