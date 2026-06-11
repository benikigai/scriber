import { NextRequest, NextResponse } from "next/server";
import { listGitHubPullRequests } from "@/server/tools/github";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await listGitHubPullRequests(body));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "GitHub PR list failed" }, { status: 500 });
  }
}
