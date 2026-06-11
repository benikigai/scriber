type SlackMessage = {
  type?: string;
  user?: string;
  username?: string;
  text?: string;
  ts?: string;
};

type SlackApiResponse<T> = T & {
  ok?: boolean;
  error?: string;
};

export function slackPostConfigured() {
  return Boolean(process.env.SLACK_WEBHOOK_URL || (process.env.SLACK_BOT_TOKEN && process.env.SLACK_DEFAULT_CHANNEL_ID));
}

export function slackContextConfigured() {
  return Boolean(process.env.SLACK_BOT_TOKEN && process.env.SLACK_DEFAULT_CHANNEL_ID);
}

export async function postSlackMessage(input: { body: string; channelId?: string | null }) {
  const body = input.body.trim();
  if (!body) throw new Error("body required");

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body }),
    });
    if (!response.ok) return { success: false, delivered: false, status: response.status };
    return { success: true, delivered: true, transport: "webhook" };
  }

  const channel = input.channelId || process.env.SLACK_DEFAULT_CHANNEL_ID;
  if (!channel) throw new Error("SLACK_DEFAULT_CHANNEL_ID missing");
  await slackApi("chat.postMessage", { channel, text: body });
  return { success: true, delivered: true, transport: "bot", channel };
}

export async function fetchRecentSlackContext(args: Record<string, unknown>) {
  const channel = String(args.channel_id ?? process.env.SLACK_DEFAULT_CHANNEL_ID ?? "").trim();
  if (!channel) throw new Error("channel_id or SLACK_DEFAULT_CHANNEL_ID required");
  const limit = boundedNumber(args.limit, 12, 1, 30);
  const query = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
  const result = await slackApi<{ messages?: SlackMessage[] }>("conversations.history", {
    channel,
    limit: String(Math.min(limit * 2, 50)),
  });

  const messages = (result.messages ?? [])
    .filter((message) => message.type === "message" && message.text)
    .filter((message) => !query || message.text!.toLowerCase().includes(query))
    .slice(0, limit)
    .map((message) => ({
      speaker: message.username ?? message.user ?? "unknown",
      text: message.text,
      timestamp: slackTimestampToIso(message.ts),
    }));

  return { channel, messages };
}

async function slackApi<T>(method: string, params: Record<string, string>): Promise<SlackApiResponse<T>> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN missing");

  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const body = (await response.json()) as SlackApiResponse<T>;
  if (!response.ok || !body.ok) {
    throw new Error(body.error ?? `Slack ${method} failed with ${response.status}`);
  }
  return body;
}

function slackTimestampToIso(ts?: string) {
  if (!ts) return null;
  const seconds = Number(ts.split(".")[0]);
  if (!Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(Math.max(Math.trunc(number), min), max);
}
