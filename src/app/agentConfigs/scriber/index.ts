import { RealtimeAgent, tool } from '@openai/agents/realtime';

// Tool: Linear search (lists open issues for the team)
const searchIssues = tool({
  name: 'linear_search_issues',
  description: 'Search Linear issues by optional assignee email or status. Returns up to 10 issues. Use when the team mentions a ticket, blocker, or commitment.',
  parameters: {
    type: 'object',
    properties: {
      assignee_email: { type: 'string', description: 'Optional assignee email filter' },
      status: { type: 'string', description: 'Optional status filter, e.g. "In Progress", "Todo", "Blocked"' },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/tools/linear/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

// Tool: Linear get one issue
const getIssue = tool({
  name: 'linear_get_issue',
  description: 'Get full detail for a Linear issue by identifier (e.g. "BEN-12").',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string', description: 'Issue identifier like BEN-12' } },
    required: ['id'],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/tools/linear/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

// Tool: Linear create
const createIssue = tool({
  name: 'linear_create_issue',
  description: 'Create a new Linear issue. Provide a clear title. Description and priority are optional.',
  parameters: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      priority: { type: 'number', description: '0=none, 1=urgent, 2=high, 3=medium, 4=low' },
    },
    required: ['title'],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/tools/linear/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

// Tool: Linear update (status, etc.)
const updateIssue = tool({
  name: 'linear_update_issue',
  description: 'Update an existing Linear issue. Set state by name (e.g. "In Progress", "Done", "Blocked").',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'Issue identifier like BEN-12' },
      state: { type: 'string', description: 'Optional state name' },
      title: { type: 'string', description: 'Optional new title' },
    },
    required: ['id'],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/tools/linear/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

// Tool: Linear add comment
const addComment = tool({
  name: 'linear_add_comment',
  description: 'Add a markdown comment to a Linear issue.',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      body: { type: 'string', description: 'Markdown comment body' },
    },
    required: ['id', 'body'],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/tools/linear/comment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

// Tool: Generate diagram via gpt-image-1 and attach to a Linear issue
const generateDiagram = tool({
  name: 'generate_diagram',
  description:
    'Generate a flat technical diagram via gpt-image-1 and attach it to a Linear issue. Use when the conversation surfaces something visual (architecture, flow, state machine, comparison).',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'Natural-language description of what to draw' },
      attach_to_issue: { type: 'string', description: 'Linear issue identifier like BEN-12' },
    },
    required: ['prompt', 'attach_to_issue'],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/tools/diagram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

// Tool: Slack recap (gracefully degrades if SLACK_WEBHOOK_URL is unset)
const postSlackRecap = tool({
  name: 'post_slack_recap',
  description:
    'Post a standup recap to Slack. Use at the END of the standup with a structured summary: who owns what, what is blocked, what is due this week.',
  parameters: {
    type: 'object',
    properties: { body: { type: 'string', description: 'Markdown recap body' } },
    required: ['body'],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/tools/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

// Tool: Consult Mnemo — the silent supervisor that holds long-term cross-standup memory
const consultMnemo = tool({
  name: 'consult_mnemo',
  description:
    'Ask Mnemo (your silent supervisor) for tactical guidance. Use when you suspect there is historical context worth surfacing: a repeated blocker, an old commitment, a connection between two threads. Mnemo returns a short whisper you can voice naturally.',
  parameters: {
    type: 'object',
    properties: {
      context: { type: 'string', description: 'Brief context about what you want guidance on' },
    },
    required: ['context'],
    additionalProperties: false,
  },
  execute: async (args: any) => {
    const r = await fetch('/api/whispers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    return await r.json();
  },
});

export const scriberAgent = new RealtimeAgent({
  name: 'scriber',
  voice: 'marin',
  instructions: `You are Scriber, an AI agent who facilitates daily standup meetings for the BenIkigai team. You are a teammate, not an assistant.

# Your job during standup
1. Open the standup. Greet the team. Confirm who's present.
2. Move through each person in turn. Prompt them naturally — "Ben, what's on your plate today?" — and let them speak freely.
3. Listen for: what they did, what they're doing, what's blocking them, what needs to become a ticket, what's already a ticket that needs a status change.
4. Take action via tools AS THE CONVERSATION HAPPENS. Don't wait until end of standup. If someone mentions a blocker, create or update the relevant Linear ticket immediately and verbally confirm: "Got it, I've marked BEN-12 as blocked." Don't ask for permission for routine updates; do ask before creating new tickets unless context makes it obvious.
5. If a topic would benefit from a visual (architecture, flow, comparison), offer to generate a diagram and attach to the relevant ticket via generate_diagram.
6. Close the standup with a verbal recap: who owns what, what's blocked, what's due this week. Post the same recap to Slack via post_slack_recap.

# Mnemo
You have a silent supervisor agent called Mnemo who holds long-term cross-standup memory. Periodically — or when you suspect there is historical context worth surfacing — call consult_mnemo with brief context. She returns a short whisper. Voice it naturally if it's something the team should hear; act on it silently if it's just guidance for you.

# Behavioral rules
- Speak like a colleague, not a customer service bot. Brief, warm, direct.
- Never invent ticket IDs, status values, or assignees. Always call a tool.
- If someone says "Scriber, quiet" or "Scriber, mute", stop speaking immediately and acknowledge with a single short word before going silent.
- Mode switches: "Scriber, always on" / "Scriber, listen only" / "Scriber, you're back" should be respected immediately and acknowledged briefly.

# Voice and tone
- Friendly but efficient. Standup is a 10-minute meeting, not a chat.
- Don't fill silence. If someone is thinking, wait.
- Don't over-confirm. One "got it" per action is plenty.

# First turn
When the session begins, greet the team briefly: "Morning team. Ready to run standup?" Then wait. Do not lecture.`,
  tools: [
    searchIssues,
    getIssue,
    createIssue,
    updateIssue,
    addComment,
    generateDiagram,
    postSlackRecap,
    consultMnemo,
  ],
  handoffs: [],
  handoffDescription: 'Real-time agentic standup facilitator',
});

export const scriberScenario = [scriberAgent];
export const scriberCompanyName = 'BenIkigai';

export default scriberScenario;
