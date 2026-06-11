import type { ScriberToolName } from "@/lib/scriberToolSpecs";

export type MeetingPlatform = "zoom" | "google_meet";

export type MeetingBotStatus =
  | "scheduled"
  | "staged"
  | "joining"
  | "waiting_room"
  | "joined"
  | "listening"
  | "active"
  | "quiet"
  | "ended"
  | "error";

export type WakeMode = "wake" | "always_on" | "listen_only";

export type BotCommandType =
  | "leave"
  | "mute"
  | "unmute"
  | "quiet"
  | "wake"
  | "capture"
  | "manual_speak";

export type ArtifactKind = "screenshot" | "audio" | "transcript" | "debug";

export type CalendarProvider = "google" | "microsoft";

export type ToolProposalStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

export type MeetingBotRecord = {
  id: string;
  meetingUrl: string;
  platform: MeetingPlatform;
  title: string;
  botName: string;
  botToken: string;
  status: MeetingBotStatus;
  wakeMode: WakeMode;
  joinAt: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  endedAt: string | null;
  lastError: string | null;
  muted: boolean;
  screenShareActive: boolean;
  consentAnnounced: boolean;
  artifactCaptureIntervalSeconds: number;
};

export type TranscriptEntry = {
  id: string;
  meetingBotId: string;
  role: "user" | "assistant" | "system";
  speaker: string | null;
  text: string;
  isFinal: boolean;
  createdAt: string;
};

export type ParticipantRecord = {
  id: string;
  meetingBotId: string;
  externalId: string | null;
  name: string;
  status: "joined" | "left" | "speaking" | "muted" | "unknown";
  joinedAt: string | null;
  leftAt: string | null;
  updatedAt: string;
};

export type MeetingArtifact = {
  id: string;
  meetingBotId: string;
  kind: ArtifactKind;
  title: string;
  url: string | null;
  mimeType: string | null;
  transcriptEntryId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ToolProposalRecord = {
  id: string;
  meetingBotId: string | null;
  source: "meeting" | "browser" | "api";
  toolName: ScriberToolName | string;
  title: string;
  arguments: Record<string, unknown>;
  status: ToolProposalStatus;
  result: unknown | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventRecord = {
  id: string;
  provider: CalendarProvider;
  externalId: string;
  title: string;
  meetingUrl: string;
  platform: MeetingPlatform;
  startsAt: string;
  endsAt: string | null;
  responseStatus: "accepted" | "tentative" | "declined" | "needs_action" | "unknown";
  visibility: "default" | "public" | "private" | "confidential";
  cancelled: boolean;
  scheduledBotId: string | null;
  updatedAt: string;
};

export type BotCommand = {
  id: string;
  meetingBotId: string;
  type: BotCommandType;
  text: string | null;
  createdAt: string;
};

export type MeetingBotSnapshot = {
  bot: MeetingBotRecord;
  transcript: TranscriptEntry[];
  participants: ParticipantRecord[];
  artifacts: MeetingArtifact[];
  proposals: ToolProposalRecord[];
  pendingCommands: BotCommand[];
};

export type MeetingBotEvent =
  | { type: "meeting_bot.created"; bot: MeetingBotRecord }
  | { type: "meeting_bot.updated"; bot: MeetingBotRecord }
  | { type: "transcript.added"; entry: TranscriptEntry }
  | { type: "participant.updated"; participant: ParticipantRecord }
  | { type: "artifact.added"; artifact: MeetingArtifact }
  | { type: "tool_proposal.created"; proposal: ToolProposalRecord }
  | { type: "tool_proposal.updated"; proposal: ToolProposalRecord }
  | { type: "bot_command.created"; command: BotCommand };

export type CreateMeetingBotInput = {
  meetingUrl: string;
  title?: string;
  joinAt?: string | null;
  botName?: string;
  wakeMode?: WakeMode;
};

export type IncomingBotBridgeMessage =
  | {
      type: "audio.input";
      audio: string;
      sampleRate: number;
      timestampMs?: number;
      participantId?: string;
    }
  | {
      type: "caption.delta";
      text: string;
      speaker?: string;
      isFinal?: boolean;
    }
  | {
      type: "screen.frame";
      title?: string;
      url?: string;
      mimeType?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "participant.event";
      participantId?: string;
      name: string;
      status: ParticipantRecord["status"];
    }
  | {
      type: "chat.message";
      text: string;
      speaker?: string;
    }
  | {
      type: "assistant.message";
      text: string;
      isFinal?: boolean;
    }
  | {
      type: "state.changed";
      status?: MeetingBotStatus;
      screenShareActive?: boolean;
      error?: string | null;
    };

export type OutgoingBotBridgeMessage =
  | { type: "audio.output"; audio: string; sampleRate: number }
  | { type: "mic.mute"; muted: boolean }
  | { type: "chat.send"; text: string }
  | { type: "capture.request" }
  | { type: "leave" }
  | { type: "manual_speak"; text: string };
