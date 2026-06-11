import { NextRequest } from "next/server";
import {
  getMeetingBotSnapshot,
  subscribeToMeetingBotEvents,
} from "@/server/meetingBots/store";
import type { MeetingBotEvent } from "@/server/meetingBots/types";

export const dynamic = "force-dynamic";

function eventBotId(event: MeetingBotEvent) {
  switch (event.type) {
    case "meeting_bot.created":
    case "meeting_bot.updated":
      return event.bot.id;
    case "transcript.added":
      return event.entry.meetingBotId;
    case "participant.updated":
      return event.participant.meetingBotId;
    case "artifact.added":
      return event.artifact.meetingBotId;
    case "tool_proposal.created":
    case "tool_proposal.updated":
      return event.proposal.meetingBotId;
    case "bot_command.created":
      return event.command.meetingBotId;
    default:
      return null;
  }
}

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = getMeetingBotSnapshot(id);
  if (!snapshot) {
    return new Response(JSON.stringify({ error: "meeting bot not found" }), { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse("snapshot", snapshot)));

      const unsubscribe = subscribeToMeetingBotEvents((event) => {
        if (eventBotId(event) === id) {
          controller.enqueue(encoder.encode(encodeSse(event.type, event)));
        }
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 15_000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
