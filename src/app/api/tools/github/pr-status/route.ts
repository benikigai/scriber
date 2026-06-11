import { NextRequest, NextResponse } from "next/server";
import { getGitHubPullRequestStatus } from "@/server/tools/github";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await getGitHubPullRequestStatus(body));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "GitHub PR status failed" }, { status: 500 });
  }
}
