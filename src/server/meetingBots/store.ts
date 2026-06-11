import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import type {
  BotCommand,
  BotCommandType,
  CalendarEventRecord,
  CreateMeetingBotInput,
  IncomingBotBridgeMessage,
  MeetingArtifact,
  MeetingBotEvent,
  MeetingBotRecord,
  MeetingBotSnapshot,
  ParticipantRecord,
  ToolProposalRecord,
  TranscriptEntry,
  WakeMode,
} from "./types";
import { assertSupportedMeetingUrl } from "./urls";

type Listener = (event: MeetingBotEvent) => void;

type StoreState = {
  bots: Map<string, MeetingBotRecord>;
  transcripts: Map<string, TranscriptEntry[]>;
  participants: Map<string, ParticipantRecord[]>;
  artifacts: Map<string, MeetingArtifact[]>;
  proposals: Map<string, ToolProposalRecord>;
  commands: Map<string, BotCommand[]>;
  calendarEvents: Map<string, CalendarEventRecord>;
  listeners: Set<Listener>;
};

type StoreDiskSnapshot = {
  bots?: MeetingBotRecord[];
  transcripts?: Record<string, TranscriptEntry[]>;
  participants?: Record<string, ParticipantRecord[]>;
  artifacts?: Record<string, MeetingArtifact[]>;
  proposals?: ToolProposalRecord[];
  commands?: Record<string, BotCommand[]>;
  calendarEvents?: CalendarEventRecord[];
};

const STORE_SYMBOL = Symbol.for("scriber.meetingBotStore");

function now() {
  return new Date().toISOString();
}

function storeFilePath() {
  if (process.env.SCRIBER_STORE_FILE) return process.env.SCRIBER_STORE_FILE;
  if (process.env.SCRIBER_DATA_DIR) return path.join(process.env.SCRIBER_DATA_DIR, "meeting-store.json");
  return null;
}

function mapFromRecord<T>(record: Record<string, T[]> | undefined) {
  return new Map(Object.entries(record ?? {}));
}

function loadDiskSnapshot(): StoreDiskSnapshot | null {
  const filePath = storeFilePath();
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as StoreDiskSnapshot;
  } catch (error: any) {
    console.warn(`[scriber/store] failed to read ${filePath}: ${error?.message ?? error}`);
    return null;
  }
}

function makeState(): StoreState {
  const snapshot = loadDiskSnapshot();
  return {
    bots: new Map((snapshot?.bots ?? []).map((bot) => [bot.id, bot])),
    transcripts: mapFromRecord(snapshot?.transcripts),
    participants: mapFromRecord(snapshot?.participants),
    artifacts: mapFromRecord(snapshot?.artifacts),
    proposals: new Map((snapshot?.proposals ?? []).map((proposal) => [proposal.id, proposal])),
    commands: mapFromRecord(snapshot?.commands),
    calendarEvents: new Map((snapshot?.calendarEvents ?? []).map((event) => [event.id, event])),
    listeners: new Set(),
  };
}

function state(): StoreState {
  const globalStore = globalThis as unknown as Record<symbol, StoreState | undefined>;
  globalStore[STORE_SYMBOL] ??= makeState();
  return globalStore[STORE_SYMBOL]!;
}

function publish(event: MeetingBotEvent) {
  for (const listener of state().listeners) {
    listener(event);
  }
}

function persistState() {
  const filePath = storeFilePath();
  if (!filePath) return;

  try {
    const store = state();
    const snapshot: StoreDiskSnapshot = {
      bots: Array.from(store.bots.values()),
      transcripts: Object.fromEntries(store.transcripts.entries()),
      participants: Object.fromEntries(store.participants.entries()),
      artifacts: Object.fromEntries(store.artifacts.entries()),
      proposals: Array.from(store.proposals.values()),
      commands: Object.fromEntries(store.commands.entries()),
      calendarEvents: Array.from(store.calendarEvents.values()),
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
    fs.renameSync(tempPath, filePath);
  } catch (error: any) {
    console.warn(`[scriber/store] failed to persist state: ${error?.message ?? error}`);
  }
}

function defaultStatus(joinAt: string | null) {
  if (!joinAt) return "staged" as const;
  return new Date(joinAt).getTime() > Date.now() ? "scheduled" : "staged";
}

function snapshotFor(bot: MeetingBotRecord): MeetingBotSnapshot {
  const store = state();
  return {
    bot,
    transcript: store.transcripts.get(bot.id) ?? [],
    participants: store.participants.get(bot.id) ?? [],
    artifacts: store.artifacts.get(bot.id) ?? [],
    proposals: Array.from(store.proposals.values()).filter((proposal) => proposal.meetingBotId === bot.id),
    pendingCommands: store.commands.get(bot.id) ?? [],
  };
}

export function resetMeetingBotStoreForTests() {
  const globalStore = globalThis as unknown as Record<symbol, StoreState | undefined>;
  globalStore[STORE_SYMBOL] = makeState();
}

export function subscribeToMeetingBotEvents(listener: Listener) {
  state().listeners.add(listener);
  return () => {
    state().listeners.delete(listener);
  };
}

export function listMeetingBots() {
  return Array.from(state().bots.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getMeetingBot(id: string) {
  return state().bots.get(id) ?? null;
}

export function getMeetingBotSnapshot(id: string) {
  const bot = getMeetingBot(id);
  return bot ? snapshotFor(bot) : null;
}

export function listToolProposals(meetingBotId?: string | null) {
  const proposals = Array.from(state().proposals.values());
  return proposals
    .filter((proposal) => !meetingBotId || proposal.meetingBotId === meetingBotId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getToolProposal(id: string) {
  return state().proposals.get(id) ?? null;
}

export function createMeetingBot(input: CreateMeetingBotInput) {
  const platform = assertSupportedMeetingUrl(input.meetingUrl);
  const createdAt = now();
  const joinAt = input.joinAt ? new Date(input.joinAt).toISOString() : null;
  const bot: MeetingBotRecord = {
    id: randomUUID(),
    meetingUrl: input.meetingUrl,
    platform,
    title: input.title?.trim() || `${platform === "zoom" ? "Zoom" : "Google Meet"} meeting`,
    botName: input.botName?.trim() || "Scriber",
    botToken: randomUUID(),
    status: defaultStatus(joinAt),
    wakeMode: input.wakeMode ?? "wake",
    joinAt,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    endedAt: null,
    lastError: null,
    muted: false,
    screenShareActive: false,
    consentAnnounced: false,
    artifactCaptureIntervalSeconds: 15,
  };
  state().bots.set(bot.id, bot);
  persistState();
  publish({ type: "meeting_bot.created", bot });
  return bot;
}

export function updateMeetingBot(
  id: string,
  patch: Partial<Omit<MeetingBotRecord, "id" | "createdAt" | "botToken">>,
) {
  const store = state();
  const current = store.bots.get(id);
  if (!current) return null;
  const updated: MeetingBotRecord = {
    ...current,
    ...patch,
    updatedAt: now(),
  };
  store.bots.set(id, updated);
  persistState();
  publish({ type: "meeting_bot.updated", bot: updated });
  return updated;
}

export function enqueueBotCommand(meetingBotId: string, type: BotCommandType, text?: string | null) {
  const bot = getMeetingBot(meetingBotId);
  if (!bot) throw new Error("meeting bot not found");

  const command: BotCommand = {
    id: randomUUID(),
    meetingBotId,
    type,
    text: text ?? null,
    createdAt: now(),
  };
  const commands = state().commands.get(meetingBotId) ?? [];
  commands.push(command);
  state().commands.set(meetingBotId, commands);
  persistState();

  if (type === "quiet") updateMeetingBot(meetingBotId, { status: "quiet", wakeMode: "listen_only", muted: true });
  if (type === "wake") updateMeetingBot(meetingBotId, { status: "active", wakeMode: "wake", muted: false });
  if (type === "mute") updateMeetingBot(meetingBotId, { muted: true });
  if (type === "unmute") updateMeetingBot(meetingBotId, { muted: false });
  if (type === "leave") updateMeetingBot(meetingBotId, { status: "ended", endedAt: now() });

  publish({ type: "bot_command.created", command });
  return command;
}

export function drainBotCommands(meetingBotId: string) {
  const commands = state().commands.get(meetingBotId) ?? [];
  state().commands.set(meetingBotId, []);
  persistState();
  return commands;
}

export function addTranscriptEntry(input: {
  meetingBotId: string;
  role: TranscriptEntry["role"];
  speaker?: string | null;
  text: string;
  isFinal?: boolean;
}) {
  const entry: TranscriptEntry = {
    id: randomUUID(),
    meetingBotId: input.meetingBotId,
    role: input.role,
    speaker: input.speaker ?? null,
    text: input.text,
    isFinal: input.isFinal ?? true,
    createdAt: now(),
  };
  const transcript = state().transcripts.get(input.meetingBotId) ?? [];
  transcript.push(entry);
  state().transcripts.set(input.meetingBotId, transcript.slice(-500));
  persistState();
  publish({ type: "transcript.added", entry });
  return entry;
}

export function upsertParticipant(input: {
  meetingBotId: string;
  externalId?: string | null;
  name: string;
  status: ParticipantRecord["status"];
}) {
  const participants = state().participants.get(input.meetingBotId) ?? [];
  const match = participants.find(
    (participant) =>
      (input.externalId && participant.externalId === input.externalId) ||
      participant.name.toLowerCase() === input.name.toLowerCase(),
  );
  const updatedAt = now();
  const participant: ParticipantRecord = match
    ? {
        ...match,
        status: input.status,
        leftAt: input.status === "left" ? updatedAt : match.leftAt,
        updatedAt,
      }
    : {
        id: randomUUID(),
        meetingBotId: input.meetingBotId,
        externalId: input.externalId ?? null,
        name: input.name,
        status: input.status,
        joinedAt: input.status === "joined" ? updatedAt : null,
        leftAt: input.status === "left" ? updatedAt : null,
        updatedAt,
      };

  const next = match
    ? participants.map((existing) => (existing.id === participant.id ? participant : existing))
    : [...participants, participant];
  state().participants.set(input.meetingBotId, next);
  persistState();
  publish({ type: "participant.updated", participant });
  return participant;
}

export function addMeetingArtifact(input: {
  meetingBotId: string;
  kind: MeetingArtifact["kind"];
  title?: string;
  url?: string | null;
  mimeType?: string | null;
  transcriptEntryId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const artifact: MeetingArtifact = {
    id: randomUUID(),
    meetingBotId: input.meetingBotId,
    kind: input.kind,
    title: input.title ?? input.kind,
    url: input.url ?? null,
    mimeType: input.mimeType ?? null,
    transcriptEntryId: input.transcriptEntryId ?? null,
    metadata: input.metadata ?? {},
    createdAt: now(),
  };
  const artifacts = state().artifacts.get(input.meetingBotId) ?? [];
  artifacts.push(artifact);
  state().artifacts.set(input.meetingBotId, artifacts.slice(-200));
  persistState();
  publish({ type: "artifact.added", artifact });
  return artifact;
}

export function createToolProposal(input: {
  meetingBotId?: string | null;
  source?: ToolProposalRecord["source"];
  toolName: string;
  title: string;
  arguments: Record<string, unknown>;
}) {
  const createdAt = now();
  const proposal: ToolProposalRecord = {
    id: randomUUID(),
    meetingBotId: input.meetingBotId ?? null,
    source: input.source ?? "api",
    toolName: input.toolName,
    title: input.title,
    arguments: input.arguments,
    status: "pending",
    result: null,
    error: null,
    createdAt,
    updatedAt: createdAt,
  };
  state().proposals.set(proposal.id, proposal);
  persistState();
  publish({ type: "tool_proposal.created", proposal });
  return proposal;
}

export function updateToolProposal(
  id: string,
  patch: Partial<Pick<ToolProposalRecord, "status" | "result" | "error">>,
) {
  const current = state().proposals.get(id);
  if (!current) return null;
  const proposal = {
    ...current,
    ...patch,
    updatedAt: now(),
  };
  state().proposals.set(id, proposal);
  persistState();
  publish({ type: "tool_proposal.updated", proposal });
  return proposal;
}

export function upsertCalendarEvent(event: CalendarEventRecord) {
  state().calendarEvents.set(event.id, event);
  persistState();
  return event;
}

export function listCalendarEvents() {
  return Array.from(state().calendarEvents.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function authenticateBot(meetingBotId: string, token: string | null) {
  const bot = getMeetingBot(meetingBotId);
  return Boolean(bot && token && bot.botToken === token);
}

export function applyBotBridgeMessage(meetingBotId: string, message: IncomingBotBridgeMessage) {
  const bot = getMeetingBot(meetingBotId);
  if (!bot) throw new Error("meeting bot not found");

  switch (message.type) {
    case "caption.delta":
      return addTranscriptEntry({
        meetingBotId,
        role: "user",
        speaker: message.speaker ?? null,
        text: message.text,
        isFinal: message.isFinal ?? true,
      });
    case "chat.message":
      return addTranscriptEntry({
        meetingBotId,
        role: "user",
        speaker: message.speaker ?? null,
        text: message.text,
        isFinal: true,
      });
    case "assistant.message":
      return addTranscriptEntry({
        meetingBotId,
        role: "assistant",
        speaker: "Scriber",
        text: message.text,
        isFinal: message.isFinal ?? true,
      });
    case "screen.frame":
      updateMeetingBot(meetingBotId, { screenShareActive: true });
      return addMeetingArtifact({
        meetingBotId,
        kind: "screenshot",
        title: message.title ?? "Screen share",
        url: message.url ?? null,
        mimeType: message.mimeType ?? null,
        metadata: message.metadata ?? {},
      });
    case "participant.event":
      return upsertParticipant({
        meetingBotId,
        externalId: message.participantId ?? null,
        name: message.name,
        status: message.status,
      });
    case "state.changed":
      return updateMeetingBot(meetingBotId, {
        status: message.status ?? bot.status,
        screenShareActive: message.screenShareActive ?? bot.screenShareActive,
        lastError: message.error ?? bot.lastError,
        startedAt:
          message.status === "joined" || message.status === "listening" || message.status === "active"
            ? bot.startedAt ?? now()
            : bot.startedAt,
        endedAt: message.status === "ended" ? now() : bot.endedAt,
      });
    case "audio.input":
      if (bot.status === "staged") return updateMeetingBot(meetingBotId, { status: "listening" });
      return null;
    default:
      return null;
  }
}

export function parseWakeMode(value: unknown): WakeMode {
  return value === "always_on" || value === "listen_only" || value === "wake" ? value : "wake";
}
