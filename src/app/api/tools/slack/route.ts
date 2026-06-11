import { NextRequest, NextResponse } from 'next/server';
import { postSlackMessage } from '@/server/tools/slack';

export async function POST(req: NextRequest) {
  try {
    const { body, channel_id } = await req.json();
    if (!body) return NextResponse.json({ error: 'body required' }, { status: 400 });
    if (!process.env.SLACK_WEBHOOK_URL && !process.env.SLACK_BOT_TOKEN) {
      console.log('[scriber/slack] SLACK_WEBHOOK_URL unset — recap logged only:');
      console.log(body);
      return NextResponse.json({
        success: false,
        delivered: false,
        reason: 'Slack is not configured; recap logged to server stdout only',
      });
    }
    return NextResponse.json(await postSlackMessage({ body, channelId: channel_id }));
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'slack post failed' }, { status: 500 });
  }
}
