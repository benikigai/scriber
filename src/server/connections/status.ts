import { googleCalendarConfigured, GOOGLE_CALENDAR_SCOPES, googleCalendarCanWrite } from "@/server/calendar/google";
import { getGoogleCalendarConnection } from "@/server/calendar/googleConnectionStore";
import { githubConfigured } from "@/server/tools/github";
import { slackContextConfigured, slackPostConfigured } from "@/server/tools/slack";

export type ConnectionStatus = {
  id: string;
  name: string;
  configured: boolean;
  connected: boolean;
  status: "connected" | "ready" | "missing" | "action_needed";
  capabilities: string[];
  env: string[];
  action?: { label: string; href: string } | null;
  notes?: string[];
};

export function listConnectionStatuses(): ConnectionStatus[] {
  const googleConnection = getGoogleCalendarConnection();
  const googleConfigured = googleCalendarConfigured();
  const googleWritable = googleConnection ? googleCalendarCanWrite(googleConnection) : false;
  const slackCanRead = slackContextConfigured();
  const slackCanPost = slackPostConfigured();
  const githubReady = githubConfigured();

  return [
    {
      id: "google-calendar",
      name: "Google Calendar",
      configured: googleConfigured,
      connected: Boolean(googleConnection),
      status: googleConnection ? (googleWritable ? "connected" : "action_needed") : googleConfigured ? "ready" : "missing",
      capabilities: [
        "auto-schedule accepted Zoom/Meet events",
        "sync upcoming meetings",
        googleWritable ? "create follow-up events" : "follow-up event creation after reconnect",
      ],
      env: ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET", "GOOGLE_CALENDAR_REDIRECT_URI"],
      action: googleConnection ? null : { label: "Connect", href: "/api/calendar/google/connect" },
      notes: googleConnection
        ? googleWritable
          ? [`Connected as ${googleConnection.email}`]
          : ["Reconnect to grant calendar event write access."]
        : [`OAuth scopes: ${GOOGLE_CALENDAR_SCOPES.join(", ")}`],
    },
    {
      id: "linear",
      name: "Linear",
      configured: Boolean(process.env.LINEAR_API_KEY),
      connected: Boolean(process.env.LINEAR_API_KEY),
      status: process.env.LINEAR_API_KEY ? "connected" : "missing",
      capabilities: ["search/read issues", "create issues", "update status, owner, priority", "add comments"],
      env: ["LINEAR_API_KEY", "LINEAR_TEAM_KEY"],
      action: null,
    },
    {
      id: "slack",
      name: "Slack",
      configured: slackCanRead || slackCanPost,
      connected: slackCanRead || slackCanPost,
      status: slackCanRead || slackCanPost ? "connected" : "missing",
      capabilities: [
        slackCanRead ? "read recent channel context" : "read channel context after bot token setup",
        slackCanPost ? "post recaps" : "post recaps after webhook or bot setup",
      ],
      env: ["SLACK_BOT_TOKEN", "SLACK_DEFAULT_CHANNEL_ID", "SLACK_WEBHOOK_URL"],
      action: null,
      notes: slackCanRead ? undefined : ["Invite the Slack app/bot to the default channel."],
    },
    {
      id: "github",
      name: "GitHub",
      configured: githubReady,
      connected: githubReady,
      status: githubReady ? "connected" : "missing",
      capabilities: ["list open PRs", "read PR checks and merge state", "surface code-review blockers"],
      env: ["GITHUB_TOKEN", "GITHUB_DEFAULT_REPO"],
      action: null,
    },
    {
      id: "openai",
      name: "OpenAI Realtime",
      configured: Boolean(process.env.OPENAI_API_KEY),
      connected: Boolean(process.env.OPENAI_API_KEY),
      status: process.env.OPENAI_API_KEY ? "connected" : "missing",
      capabilities: ["Realtime voice bridge", "Mnemo memory consults", "diagram generation"],
      env: ["OPENAI_API_KEY"],
      action: null,
    },
    {
      id: "zoom",
      name: "Zoom",
      configured: Boolean(process.env.ZOOM_MEETING_SDK_KEY && process.env.ZOOM_MEETING_SDK_SECRET),
      connected: Boolean(process.env.ZOOM_MEETING_SDK_KEY && process.env.ZOOM_MEETING_SDK_SECRET),
      status: process.env.ZOOM_MEETING_SDK_KEY && process.env.ZOOM_MEETING_SDK_SECRET ? "ready" : "missing",
      capabilities: ["Zoom runtime boundary", "native SDK join after credentials/raw-data approval"],
      env: ["ZOOM_MEETING_SDK_KEY", "ZOOM_MEETING_SDK_SECRET"],
      action: null,
    },
  ];
}
