import { NextRequest, NextResponse } from 'next/server';
import { linear } from '@/lib/linear';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const issue = await linear().issue(id);
    const state = await issue.state;
    const assignee = await issue.assignee;
    const comments = await issue.comments({ first: 5 });
    return NextResponse.json({
      identifier: issue.identifier,
      title: issue.title,
      description: issue.description,
      state: state?.name ?? null,
      assignee: assignee?.email ?? null,
      url: issue.url,
      comments: comments.nodes.map((c) => ({ body: c.body, createdAt: c.createdAt })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'get failed' }, { status: 500 });
  }
}
