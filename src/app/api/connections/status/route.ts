import { NextResponse } from "next/server";
import { listConnectionStatuses } from "@/server/connections/status";

export async function GET() {
  return NextResponse.json({ connections: listConnectionStatuses() });
}
