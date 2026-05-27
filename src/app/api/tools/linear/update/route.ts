import { NextRequest, NextResponse } from 'next/server';
import { linear } from '@/lib/linear';

export async function POST(req: NextRequest) {
  try {
    const { id, state, title } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const issue = await linear().issue(id);
    const team = await issue.team;
    const update: any = {};
    if (title) update.title = title;
    if (state && team) {
      const states = await team.states();
      const match = states.nodes.find(
        (s) => s.name.toLowerCase() === state.toLowerCase()
      );
      if (match) update.stateId = match.id;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'nothing to update (provide state or title)' }, { status: 400 });
    }
    const result = await linear().updateIssue(issue.id, update);
    return NextResponse.json({ success: result.success, identifier: id, applied: update });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'update failed' }, { status: 500 });
  }
}
