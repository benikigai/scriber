import { NextRequest, NextResponse } from "next/server";
import { approveAndExecuteToolProposal } from "@/server/tools/scriberToolExecutor";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = await approveAndExecuteToolProposal(id);
    return NextResponse.json({ proposal });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "approval failed" }, { status: 500 });
  }
}
