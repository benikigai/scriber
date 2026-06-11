import { NextRequest, NextResponse } from "next/server";
import { fetchRecentSlackContext } from "@/server/tools/slack";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await fetchRecentSlackContext(body));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Slack context failed" }, { status: 500 });
  }
}
