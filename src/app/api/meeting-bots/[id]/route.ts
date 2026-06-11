import { NextRequest, NextResponse } from "next/server";
import { getMeetingBotSnapshot } from "@/server/meetingBots/store";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = getMeetingBotSnapshot(id);
  if (!snapshot) return NextResponse.json({ error: "meeting bot not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}
