import { NextRequest, NextResponse } from "next/server";
import { adapterReadiness } from "@/server/meetingBots/adapters";
import {
  createMeetingBot,
  listMeetingBots,
  parseWakeMode,
  updateMeetingBot,
} from "@/server/meetingBots/store";

export async function GET() {
  return NextResponse.json({ bots: listMeetingBots() });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bot = createMeetingBot({
      meetingUrl: String(body.meetingUrl ?? ""),
      title: typeof body.title === "string" ? body.title : undefined,
      joinAt: typeof body.joinAt === "string" && body.joinAt ? body.joinAt : null,
      botName: typeof body.botName === "string" ? body.botName : "Scriber",
      wakeMode: parseWakeMode(body.wakeMode),
    });

    const readiness = adapterReadiness(bot.platform);
    const updated = updateMeetingBot(bot.id, {
      lastError: readiness.ready ? null : `Runtime missing: ${readiness.missing.join(", ")}`,
    });

    return NextResponse.json({
      bot: updated ?? bot,
      adapter: readiness,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "create meeting bot failed" }, { status: 400 });
  }
}
