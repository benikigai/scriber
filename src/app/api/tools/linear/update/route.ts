import { NextRequest, NextResponse } from 'next/server';
import { linear, resolveUserId } from '@/lib/linear';

export async function POST(req: NextRequest) {
  try {
    const { id, state, title, assignee, priority } = await req.json();
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
    if (assignee !== undefined) {
      if (assignee === null || assignee === '') {
        update.assigneeId = null;
      } else {
        const userId = await resolveUserId(String(assignee));
        if (!userId) {
          return NextResponse.json(
            { error: `assignee "${assignee}" not found (try email, display name, or "me")` },
            { status: 400 },
          );
        }
        update.assigneeId = userId;
      }
    }
    if (priority !== undefined && priority !== null) {
      const p = Number(priority);
      if (!Number.isInteger(p) || p < 0 || p > 4) {
        return NextResponse.json(
          { error: 'priority must be 0..4 (0=none, 1=urgent, 2=high, 3=medium, 4=low)' },
          { status: 400 },
        );
      }
      update.priority = p;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: 'nothing to update (provide state, title, assignee, or priority)' },
        { status: 400 },
      );
    }
    const result = await linear().updateIssue(issue.id, update);
    return NextResponse.json({ success: result.success, identifier: id, applied: update });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'update failed' }, { status: 500 });
  }
}
