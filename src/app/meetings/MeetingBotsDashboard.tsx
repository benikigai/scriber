"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  BotCommandType,
  MeetingBotRecord,
  MeetingBotSnapshot,
  ToolProposalRecord,
} from "@/server/meetingBots/types";
import { scriberToolSpecs } from "@/lib/scriberToolSpecs";

type AdapterReadiness = {
  platform: "zoom" | "google_meet";
  ready: boolean;
  runtime: string;
  missing: string[];
  capabilities: string[];
};

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  lastSyncedAt: string | null;
};

type ConnectionStatus = {
  id: string;
  name: string;
  configured: boolean;
  connected: boolean;
  status: "connected" | "ready" | "missing" | "action_needed";
  capabilities: string[];
  env: string[];
  action?: { label: string; href: string } | null;
  notes?: string[] | null;
};

const COMMANDS: { type: BotCommandType; label: string }[] = [
  { type: "wake", label: "Wake" },
  { type: "quiet", label: "Quiet" },
  { type: "mute", label: "Mute" },
  { type: "unmute", label: "Unmute" },
  { type: "capture", label: "Capture" },
  { type: "leave", label: "Leave" },
];

const TOOL_LABELS: Record<string, { label: string; category: string }> = {
  linear_search_issues: { label: "Search Linear issues", category: "Linear" },
  linear_get_issue: { label: "Read Linear issue detail", category: "Linear" },
  linear_create_issue: { label: "Create Linear issue", category: "Linear" },
  linear_update_issue: { label: "Update Linear state, owner, priority", category: "Linear" },
  linear_add_comment: { label: "Add Linear comment", category: "Linear" },
  generate_diagram: { label: "Generate diagram and attach to Linear", category: "Visuals" },
  post_slack_recap: { label: "Post standup recap", category: "Slack" },
  slack_recent_context: { label: "Read recent Slack channel context", category: "Slack" },
  github_list_pull_requests: { label: "List GitHub pull requests", category: "GitHub" },
  github_get_pull_request_status: { label: "Read PR checks and merge state", category: "GitHub" },
  calendar_schedule_followup: { label: "Schedule Google Calendar follow-up", category: "Calendar" },
  consult_mnemo: { label: "Consult long-term meeting memory", category: "Mnemo" },
};

const NEXT_TOOL_IDEAS = [
  {
    name: "Decision log",
    detail: "append approved decisions and action items to Google Docs, Notion, or Mnemo memory",
  },
  {
    name: "Email drafts",
    detail: "draft customer or stakeholder follow-ups from meeting outcomes, never send without approval",
  },
  {
    name: "Project docs",
    detail: "read specs, PRDs, and implementation notes before or during a meeting",
  },
  {
    name: "Customer context",
    detail: "pull account notes, support tickets, or CRM context into customer-facing calls",
  },
  {
    name: "User invitations",
    detail: "issue per-person access links once Scriber moves beyond the current shared internal password",
  },
];

export default function MeetingBotsDashboard() {
  const [bots, setBots] = useState<MeetingBotRecord[]>([]);
  const [snapshot, setSnapshot] = useState<MeetingBotSnapshot | null>(null);
  const [adapters, setAdapters] = useState<AdapterReadiness[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [connections, setConnections] = useState<ConnectionStatus[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [title, setTitle] = useState("");
  const [joinAt, setJoinAt] = useState("");
  const [manualSpeak, setManualSpeak] = useState("");
  const [calendarSyncing, setCalendarSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const events = new EventSource(`/api/meeting-bots/${selectedId}/events`);
    events.addEventListener("snapshot", (event) => setSnapshot(JSON.parse((event as MessageEvent).data)));
    const refreshSnapshot = () => void loadSnapshot(selectedId);
    [
      "meeting_bot.updated",
      "transcript.added",
      "participant.updated",
      "artifact.added",
      "tool_proposal.created",
      "tool_proposal.updated",
      "bot_command.created",
    ].forEach((type) => events.addEventListener(type, refreshSnapshot));
    return () => events.close();
  }, [selectedId]);

  const selectedBot = snapshot?.bot ?? bots.find((bot) => bot.id === selectedId) ?? null;
  const runtimeCommand = useMemo(() => {
    if (!selectedBot) return "";
    const script = selectedBot.platform === "google_meet" ? "meet-runtime" : "zoom-runtime";
    return `npm run ${script} -- --bot-id ${selectedBot.id} --token ${selectedBot.botToken} --url "${selectedBot.meetingUrl}"`;
  }, [selectedBot]);

  async function refresh() {
    setError(null);
    const [botsResponse, adaptersResponse, calendarResponse, connectionsResponse] = await Promise.all([
      fetch("/api/meeting-bots"),
      fetch("/api/meeting-bots/adapters"),
      fetch("/api/calendar/google/status"),
      fetch("/api/connections/status"),
    ]);
    const botsBody = await botsResponse.json();
    const adaptersBody = await adaptersResponse.json();
    const calendarBody = await calendarResponse.json();
    const connectionsBody = await connectionsResponse.json();
    setBots(botsBody.bots ?? []);
    setAdapters(adaptersBody.adapters ?? []);
    setCalendarStatus(calendarBody);
    setConnections(connectionsBody.connections ?? []);
    if (!selectedId && botsBody.bots?.[0]) setSelectedId(botsBody.bots[0].id);
    if (selectedId) await loadSnapshot(selectedId);
  }

  async function loadSnapshot(id: string) {
    const response = await fetch(`/api/meeting-bots/${id}`);
    if (!response.ok) return;
    setSnapshot(await response.json());
  }

  async function createBot(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/meeting-bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meetingUrl,
        title,
        joinAt: joinAt ? new Date(joinAt).toISOString() : null,
        wakeMode: "wake",
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Create failed");
      return;
    }
    setMeetingUrl("");
    setTitle("");
    setJoinAt("");
    setSelectedId(body.bot.id);
    await refresh();
    await loadSnapshot(body.bot.id);
  }

  async function sendCommand(type: BotCommandType, text?: string) {
    if (!selectedId) return;
    await fetch(`/api/meeting-bots/${selectedId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, text }),
    });
    if (type === "manual_speak") setManualSpeak("");
    await loadSnapshot(selectedId);
  }

  async function updateProposal(proposal: ToolProposalRecord, action: "approve" | "reject") {
    await fetch(`/api/tool-proposals/${proposal.id}/${action}`, { method: "POST" });
    if (selectedId) await loadSnapshot(selectedId);
  }

  async function syncGoogleCalendar() {
    setCalendarSyncing(true);
    setError(null);
    const response = await fetch("/api/calendar/google/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 30 }),
    });
    const body = await response.json();
    setCalendarSyncing(false);
    if (!response.ok) {
      setError(body.error ?? "Calendar sync failed");
      return;
    }
    await refresh();
  }

  async function disconnectGoogleCalendar() {
    await fetch("/api/calendar/google/disconnect", { method: "POST" });
    await refresh();
  }

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-950">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
        <Link href="/" className="text-xl font-semibold tracking-tight">
          Scriber
        </Link>
        <div className="text-sm text-neutral-500">Meeting runtime</div>
      </header>

      <div className="grid h-[calc(100vh-65px)] grid-cols-[360px_1fr] overflow-hidden">
        <aside className="overflow-y-auto border-r border-neutral-200 bg-white p-4">
          <form onSubmit={createBot} className="space-y-3">
            <input
              value={meetingUrl}
              onChange={(event) => setMeetingUrl(event.target.value)}
              placeholder="Zoom or Google Meet URL"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Title"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <input
              value={joinAt}
              onChange={(event) => setJoinAt(event.target.value)}
              type="datetime-local"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            <button
              type="submit"
              className="w-full rounded-md bg-neutral-950 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
            >
              Create Bot
            </button>
            {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          </form>

          <ConnectionSetup connections={connections} />

          <div className="mt-6 space-y-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-medium">Google Calendar</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {calendarStatus?.connected
                      ? calendarStatus.email
                      : calendarStatus?.configured
                        ? "Not connected"
                        : "OAuth not configured"}
                  </div>
                </div>
                <StatusPill
                  status={
                    calendarStatus?.connected ? "connected" : calendarStatus?.configured ? "ready" : "missing"
                  }
                />
              </div>
              {calendarStatus?.lastSyncedAt ? (
                <div className="mt-2 text-xs text-neutral-500">
                  Synced {new Date(calendarStatus.lastSyncedAt).toLocaleString()}
                </div>
              ) : null}
              <div className="mt-3 flex gap-2">
                {calendarStatus?.connected ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void syncGoogleCalendar()}
                      className="rounded-md bg-neutral-950 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
                    >
                      {calendarSyncing ? "Syncing" : "Sync"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void disconnectGoogleCalendar()}
                      className="rounded-md border border-neutral-300 px-3 py-2 text-xs hover:bg-white"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <a
                    href="/api/calendar/google/connect"
                    className="rounded-md bg-neutral-950 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800"
                  >
                    Connect
                  </a>
                )}
              </div>
            </div>

            {bots.map((bot) => (
              <button
                key={bot.id}
                onClick={() => setSelectedId(bot.id)}
                className={`w-full rounded-md border px-3 py-3 text-left text-sm ${
                  bot.id === selectedId ? "border-neutral-950 bg-neutral-100" : "border-neutral-200 bg-white hover:bg-neutral-50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{bot.title}</span>
                  <StatusPill status={bot.status} />
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                  <span>{bot.platform === "google_meet" ? "Google Meet" : "Zoom"}</span>
                  <span>{bot.joinAt ? new Date(bot.joinAt).toLocaleString() : "Now"}</span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="grid min-w-0 grid-rows-[auto_1fr] overflow-hidden">
          <div className="border-b border-neutral-200 bg-white p-4">
            {selectedBot ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-semibold">{selectedBot.title}</h1>
                    <div className="mt-1 text-xs text-neutral-500">{selectedBot.meetingUrl}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {COMMANDS.map((command) => (
                      <button
                        key={command.type}
                        onClick={() => void sendCommand(command.type)}
                        className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-100"
                      >
                        {command.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input
                    value={manualSpeak}
                    onChange={(event) => setManualSpeak(event.target.value)}
                    placeholder="Scriber says..."
                    className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
                  />
                  <button
                    onClick={() => void sendCommand("manual_speak", manualSpeak)}
                    className="rounded-md bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
                  >
                    Speak
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <InfoBox label="Runtime" value={runtimeCommand} />
                  <InfoBox label="Status" value={`${selectedBot.status} · ${selectedBot.wakeMode}`} />
                  <InfoBox label="Capture" value={selectedBot.screenShareActive ? "screen share active" : "idle"} />
                </div>
              </div>
            ) : (
              <div className="text-sm text-neutral-500">No meeting bot selected.</div>
            )}
          </div>

          <div className="grid min-h-0 grid-cols-[1.2fr_0.8fr] overflow-hidden">
            <div className="min-w-0 overflow-y-auto p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">Transcript</h2>
              <div className="space-y-2">
                {snapshot?.transcript.map((entry) => (
                  <div key={entry.id} className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm">
                    <div className="mb-1 text-xs text-neutral-500">
                      {entry.speaker ?? entry.role} · {new Date(entry.createdAt).toLocaleTimeString()}
                    </div>
                    <div>{entry.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 overflow-y-auto border-l border-neutral-200 p-4">
              <Section title="Enabled tools">
                <div className="space-y-2">
                  {scriberToolSpecs.map((spec) => {
                    const meta = TOOL_LABELS[spec.name] ?? { label: spec.name, category: "Tool" };
                    return (
                      <div key={spec.name} className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                              {meta.category}
                            </div>
                            <div className="mt-1 font-medium">{meta.label}</div>
                          </div>
                          <StatusPill status={spec.safety === "read" ? "read" : "approval"} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>

              <Section title="Next tools">
                <div className="space-y-2">
                  {NEXT_TOOL_IDEAS.map((idea) => (
                    <div key={idea.name} className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm">
                      <div className="font-medium">{idea.name}</div>
                      <div className="mt-1 text-xs leading-5 text-neutral-500">{idea.detail}</div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section title="Approvals">
                {snapshot?.proposals.map((proposal) => (
                  <div key={proposal.id} className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{proposal.title}</div>
                      <StatusPill status={proposal.status} />
                    </div>
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-neutral-100 p-2 text-xs">
                      {JSON.stringify(proposal.arguments, null, 2)}
                    </pre>
                    {proposal.status === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => void updateProposal(proposal, "approve")}
                          className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => void updateProposal(proposal, "reject")}
                          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-100"
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </Section>

              <Section title="Artifacts">
                {snapshot?.artifacts.map((artifact) => (
                  <a
                    key={artifact.id}
                    href={artifact.url ?? "#"}
                    target="_blank"
                    className="block rounded-md border border-neutral-200 bg-white p-3 text-sm hover:bg-neutral-50"
                  >
                    <div className="font-medium">{artifact.title}</div>
                    <div className="mt-1 text-xs text-neutral-500">{new Date(artifact.createdAt).toLocaleString()}</div>
                  </a>
                ))}
              </Section>

              <Section title="Adapters">
                {adapters.map((adapter) => (
                  <div key={adapter.platform} className="rounded-md border border-neutral-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{adapter.platform === "google_meet" ? "Google Meet" : "Zoom"}</span>
                      <StatusPill status={adapter.ready ? "ready" : "missing"} />
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">{adapter.runtime}</div>
                    {adapter.missing.length ? (
                      <div className="mt-2 text-xs text-amber-700">{adapter.missing.join(", ")}</div>
                    ) : null}
                  </div>
                ))}
              </Section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ConnectionSetup({ connections }: { connections: ConnectionStatus[] }) {
  const connected = connections.filter((connection) => connection.status === "connected").length;
  const total = connections.length;

  return (
    <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">Workspace setup</div>
          <div className="mt-1 text-xs leading-5 text-neutral-500">
            Shared internal credentials for now; one connected Google account powers workspace auto-join.
          </div>
        </div>
        <StatusPill status={total && connected === total ? "connected" : "setup"} />
      </div>

      <div className="mt-3 space-y-2">
        {connections.map((connection) => (
          <div key={connection.id} className="rounded-md border border-neutral-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{connection.name}</div>
              <StatusPill status={connection.status} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {connection.env.map((env) => (
                <span key={env} className="rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
                  {env}
                </span>
              ))}
            </div>
            {connection.notes?.length ? (
              <div className="mt-2 text-xs leading-5 text-neutral-500">{connection.notes[0]}</div>
            ) : null}
            {connection.action ? (
              <a
                href={connection.action.href}
                className="mt-2 inline-flex rounded-md bg-neutral-950 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                {connection.action.label}
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "ready" ||
    status === "connected" ||
    status === "listening" ||
    status === "active" ||
    status === "executed" ||
    status === "read"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "error" || status === "failed" || status === "missing"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${color}`}>{status}</span>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-2">
      <div className="font-medium text-neutral-500">{label}</div>
      <div className="mt-1 truncate text-neutral-900" title={value}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">{title}</h2>
      {children}
    </div>
  );
}
