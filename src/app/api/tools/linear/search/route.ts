import { NextRequest, NextResponse } from 'next/server';
import { linear } from '@/lib/linear';

export async function POST(req: NextRequest) {
  try {
    const { assignee_email, status } = await req.json().catch(() => ({}));
    const filter: any = {};
    if (assignee_email) filter.assignee = { email: { eq: assignee_email } };
    if (status) filter.state = { name: { eq: status } };
    const issues = await linear().issues({ filter, first: 10 });
    const out = await Promise.all(
      issues.nodes.map(async (i) => {
        const state = await i.state;
        const assignee = await i.assignee;
        return {
          identifier: i.identifier,
          title: i.title,
          state: state?.name ?? null,
          assignee: assignee?.email ?? null,
          url: i.url,
        };
      })
    );
    return NextResponse.json({ issues: out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'search failed' }, { status: 500 });
  }
}
