import { NextResponse } from "next/server";
import { allAdapterReadiness } from "@/server/meetingBots/adapters";

export async function GET() {
  return NextResponse.json({ adapters: allAdapterReadiness() });
}
