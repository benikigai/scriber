import { NextRequest, NextResponse } from 'next/server';
import { linear, defaultTeamId } from '@/lib/linear';

export async function POST(req: NextRequest) {
  try {
    const { title, description, priority } = await req.json();
    if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
    const teamId = await defaultTeamId();
    const result = await linear().createIssue({ teamId, title, description, priority });
    const issue = await result.issue;
    return NextResponse.json({
      success: result.success,
      identifier: issue?.identifier,
      url: issue?.url,
      title: issue?.title,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'create failed' }, { status: 500 });
  }
}
