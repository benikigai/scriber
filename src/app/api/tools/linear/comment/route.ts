import { NextRequest, NextResponse } from 'next/server';
import { linear } from '@/lib/linear';

export async function POST(req: NextRequest) {
  try {
    const { id, body } = await req.json();
    if (!id || !body) return NextResponse.json({ error: 'id and body required' }, { status: 400 });
    const issue = await linear().issue(id);
    const result = await linear().createComment({ issueId: issue.id, body });
    return NextResponse.json({ success: result.success, identifier: id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'comment failed' }, { status: 500 });
  }
}
