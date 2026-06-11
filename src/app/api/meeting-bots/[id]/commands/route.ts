import { NextRequest, NextResponse } from "next/server";
import { enqueueBotCommand } from "@/server/meetingBots/store";
import type { BotCommandType } from "@/server/meetingBots/types";

const COMMANDS: BotCommandType[] = ["leave", "mute", "unmute", "quiet", "wake", "capture", "manual_speak"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const type = String(body.type ?? "") as BotCommandType;
    if (!COMMANDS.includes(type)) {
      return NextResponse.json({ error: "unsupported command" }, { status: 400 });
    }
    const command = enqueueBotCommand(id, type, typeof body.text === "string" ? body.text : null);
    return NextResponse.json({ command });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "command failed" }, { status: 500 });
  }
}
