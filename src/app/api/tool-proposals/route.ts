import { NextRequest, NextResponse } from "next/server";
import { getScriberToolSpec } from "@/lib/scriberToolSpecs";
import { createToolProposal, listToolProposals } from "@/server/meetingBots/store";

export async function GET(req: NextRequest) {
  const meetingBotId = req.nextUrl.searchParams.get("meetingBotId");
  return NextResponse.json({ proposals: listToolProposals(meetingBotId) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const toolName = String(body.toolName ?? "");
    const spec = getScriberToolSpec(toolName);
    if (!spec) return NextResponse.json({ error: `Unknown tool ${toolName}` }, { status: 400 });
    if (spec.safety !== "proposal") {
      return NextResponse.json({ error: `${toolName} does not require approval` }, { status: 400 });
    }

    const args = typeof body.arguments === "object" && body.arguments ? body.arguments : {};
    const proposal = createToolProposal({
      meetingBotId: typeof body.meetingBotId === "string" ? body.meetingBotId : null,
      source: body.source === "meeting" || body.source === "browser" ? body.source : "api",
      toolName,
      title: spec.approvalTitle(args),
      arguments: args,
    });
    return NextResponse.json({
      requires_approval: true,
      proposal_id: proposal.id,
      title: proposal.title,
      status: proposal.status,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "proposal failed" }, { status: 500 });
  }
}
