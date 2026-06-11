import { NextRequest, NextResponse } from "next/server";
import { rejectToolProposal } from "@/server/tools/scriberToolExecutor";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const proposal = rejectToolProposal(id);
    return NextResponse.json({ proposal });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "reject failed" }, { status: 500 });
  }
}
