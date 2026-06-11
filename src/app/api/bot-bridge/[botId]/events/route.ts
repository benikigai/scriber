import { NextRequest, NextResponse } from "next/server";
import {
  applyBotBridgeMessage,
  authenticateBot,
} from "@/server/meetingBots/store";
import type { IncomingBotBridgeMessage } from "@/server/meetingBots/types";

function bearerToken(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice("bearer ".length).trim();
  return req.headers.get("x-bot-token");
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ botId: string }> }) {
  try {
    const { botId } = await params;
    if (!authenticateBot(botId, bearerToken(req))) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const message = (await req.json()) as IncomingBotBridgeMessage;
    if (!message?.type) return NextResponse.json({ error: "event type required" }, { status: 400 });
    const result = applyBotBridgeMessage(botId, message);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "bot event failed" }, { status: 500 });
  }
}
