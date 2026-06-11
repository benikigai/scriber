export type ScriberToolSafety = "read" | "proposal";

export type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type ScriberToolSpec = {
  name: string;
  description: string;
  parameters: JsonSchema;
  safety: ScriberToolSafety;
  approvalTitle: (args: Record<string, unknown>) => string;
};

export const scriberToolSpecs = [
  {
    name: "linear_search_issues",
    description:
      "Search Linear issues by optional assignee email or status. Returns up to 10 issues. Use when the team mentions a ticket, blocker, or commitment.",
    safety: "read",
    parameters: {
      type: "object",
      properties: {
        assignee_email: {
          type: "string",
          description: "Optional assignee email filter",
        },
        status: {
          type: "string",
          description: 'Optional status filter, e.g. "In Progress", "Todo", "Blocked"',
        },
      },
      required: [],
      additionalProperties: false,
    },
    approvalTitle: () => "Search Linear issues",
  },
  {
    name: "linear_get_issue",
    description: 'Get full detail for a Linear issue by identifier, for example "BEN-12".',
    safety: "read",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Issue identifier like BEN-12",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    approvalTitle: (args) => `Read ${String(args.id ?? "Linear issue")}`,
  },
  {
    name: "linear_create_issue",
    description:
      "Propose creating a new Linear issue. Provide a clear title. Description and priority are optional.",
    safety: "proposal",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        priority: {
          type: "number",
          description: "0=none, 1=urgent, 2=high, 3=medium, 4=low",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
    approvalTitle: (args) => `Create Linear issue: ${String(args.title ?? "Untitled")}`,
  },
  {
    name: "linear_update_issue",
    description:
      'Propose updating an existing Linear issue. Set state by name ("In Progress", "Done", "Blocked"), reassign by email or display name, change priority, or rename.',
    safety: "proposal",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Issue identifier like BEN-12",
        },
        state: {
          type: "string",
          description: 'Optional state name, e.g. "In Progress"',
        },
        title: { type: "string", description: "Optional new title" },
        assignee: {
          type: "string",
          description:
            'Optional new assignee: email, display name, or "me". Pass empty string to unassign.',
        },
        priority: {
          type: "number",
          description: "Optional priority. 0=none, 1=urgent, 2=high, 3=medium, 4=low.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    approvalTitle: (args) => `Update Linear issue ${String(args.id ?? "")}`.trim(),
  },
  {
    name: "linear_add_comment",
    description: "Propose adding a markdown comment to a Linear issue.",
    safety: "proposal",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string" },
        body: { type: "string", description: "Markdown comment body" },
      },
      required: ["id", "body"],
      additionalProperties: false,
    },
    approvalTitle: (args) => `Comment on Linear issue ${String(args.id ?? "")}`.trim(),
  },
  {
    name: "generate_diagram",
    description:
      "Propose generating a flat technical diagram and attaching it to a Linear issue. Use when the conversation surfaces architecture, flow, state machine, or comparison details.",
    safety: "proposal",
    parameters: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "Natural-language description of what to draw",
        },
        attach_to_issue: {
          type: "string",
          description: "Linear issue identifier like BEN-12",
        },
      },
      required: ["prompt", "attach_to_issue"],
      additionalProperties: false,
    },
    approvalTitle: (args) => `Generate diagram for ${String(args.attach_to_issue ?? "issue")}`,
  },
  {
    name: "post_slack_recap",
    description:
      "Propose posting a standup recap to Slack. Use at the end of the standup with a structured summary.",
    safety: "proposal",
    parameters: {
      type: "object",
      properties: {
        body: { type: "string", description: "Markdown recap body" },
        channel_id: { type: "string", description: "Optional Slack channel ID override" },
      },
      required: ["body"],
      additionalProperties: false,
    },
    approvalTitle: () => "Post Slack recap",
  },
  {
    name: "slack_recent_context",
    description:
      "Read recent Slack channel messages for meeting context. Use before or during standup when the team asks what changed in Slack or mentions a thread.",
    safety: "read",
    parameters: {
      type: "object",
      properties: {
        channel_id: {
          type: "string",
          description: "Optional Slack channel ID; defaults to SLACK_DEFAULT_CHANNEL_ID",
        },
        query: {
          type: "string",
          description: "Optional text filter for recent messages",
        },
        limit: {
          type: "number",
          description: "How many messages to return, 1 to 30",
        },
      },
      required: [],
      additionalProperties: false,
    },
    approvalTitle: () => "Read Slack context",
  },
  {
    name: "github_list_pull_requests",
    description:
      "List recent pull requests for the default GitHub repo or a specified owner/name repo. Use when standup needs engineering status.",
    safety: "read",
    parameters: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Optional repo in owner/name form; defaults to GITHUB_DEFAULT_REPO",
        },
        state: {
          type: "string",
          description: 'open, closed, or all. Defaults to "open".',
        },
        limit: {
          type: "number",
          description: "How many PRs to return, 1 to 20",
        },
      },
      required: [],
      additionalProperties: false,
    },
    approvalTitle: () => "Read GitHub pull requests",
  },
  {
    name: "github_get_pull_request_status",
    description:
      "Get a pull request's mergeability, combined status, and check runs. Use when a PR or deploy blocker comes up in standup.",
    safety: "read",
    parameters: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Optional repo in owner/name form; defaults to GITHUB_DEFAULT_REPO",
        },
        number: {
          type: "number",
          description: "Pull request number",
        },
      },
      required: ["number"],
      additionalProperties: false,
    },
    approvalTitle: (args) => `Read GitHub PR #${String(args.number ?? "")}`.trim(),
  },
  {
    name: "calendar_schedule_followup",
    description:
      "Propose creating a Google Calendar follow-up event from meeting outcomes. Never schedule without approval.",
    safety: "proposal",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        starts_at: {
          type: "string",
          description: "ISO datetime for the follow-up start",
        },
        duration_minutes: {
          type: "number",
          description: "Duration in minutes. Defaults to 30.",
        },
        attendees: {
          type: "array",
          items: { type: "string" },
          description: "Optional attendee emails",
        },
        description: { type: "string" },
        location: { type: "string" },
      },
      required: ["title", "starts_at"],
      additionalProperties: false,
    },
    approvalTitle: (args) => `Schedule follow-up: ${String(args.title ?? "Untitled")}`,
  },
  {
    name: "consult_mnemo",
    description:
      "Ask Mnemo for tactical guidance when historical context could help: a repeated blocker, old commitment, or connection between threads.",
    safety: "read",
    parameters: {
      type: "object",
      properties: {
        context: {
          type: "string",
          description: "Brief context about what you want guidance on",
        },
      },
      required: ["context"],
      additionalProperties: false,
    },
    approvalTitle: () => "Consult Mnemo",
  },
] satisfies ScriberToolSpec[];

export type ScriberToolName = (typeof scriberToolSpecs)[number]["name"];

export function getScriberToolSpec(name: string) {
  return scriberToolSpecs.find((spec) => spec.name === name);
}

export function isProposalTool(name: string) {
  return getScriberToolSpec(name)?.safety === "proposal";
}
