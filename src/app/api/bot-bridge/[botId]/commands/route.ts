import { NextRequest, NextResponse } from "next/server";
import {
  authenticateBot,
  drainBotCommands,
} from "@/server/meetingBots/store";

function bearerToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice("bearer ".length).trim();
  return req.headers.get("x-bot-token");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;
  if (!authenticateBot(botId, bearerToken(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ commands: drainBotCommands(botId) });
}
