import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { body } = await req.json();
    if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 });

    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (!webhook) {
      // Graceful degradation — log the recap server-side so we can still verify it
      console.log('[scriber/slack] SLACK_WEBHOOK_URL unset — recap logged only:');
      console.log(body);
      return NextResponse.json({
        success: false,
        delivered: false,
        reason: 'SLACK_WEBHOOK_URL not configured; recap logged to server stdout only',
      });
    }

    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: body }),
    });
    if (!r.ok) {
      return NextResponse.json(
        { success: false, delivered: false, status: r.status },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, delivered: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'slack post failed' }, { status: 500 });
  }
}
