import { RealtimeAgent, tool } from "@openai/agents/realtime";
import { getScriberToolSpec, scriberToolSpecs } from "@/lib/scriberToolSpecs";

async function callJsonRoute(path: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

function clientToolRoute(toolName: string) {
  switch (toolName) {
    case "linear_search_issues":
      return "/api/tools/linear/search";
    case "linear_get_issue":
      return "/api/tools/linear/get";
    case "slack_recent_context":
      return "/api/tools/slack/context";
    case "github_list_pull_requests":
      return "/api/tools/github/pulls";
    case "github_get_pull_request_status":
      return "/api/tools/github/pr-status";
    case "consult_mnemo":
      return "/api/whispers";
    default:
      return null;
  }
}

const tools = scriberToolSpecs.map((spec) =>
  tool({
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
    execute: async (args: any) => {
      const currentSpec = getScriberToolSpec(spec.name);
      if (!currentSpec) return { error: `Unknown tool ${spec.name}` };

      if (currentSpec.safety === "proposal") {
        return callJsonRoute("/api/tool-proposals", {
          toolName: spec.name,
          arguments: args,
          source: "browser",
        });
      }

      const route = clientToolRoute(spec.name);
      if (!route) return { error: `No browser route for ${spec.name}` };
      return callJsonRoute(route, args);
    },
  }),
);

export const scriberAgent = new RealtimeAgent({
  name: "scriber",
  voice: "marin",
  instructions: `You are Scriber, an AI agent who facilitates daily standup meetings for the BenIkigai team. You are a teammate, not an assistant.

# Your job during standup
1. Open the standup. Greet the team. Confirm who's present.
2. Move through each person in turn. Prompt them naturally and let them speak freely.
3. Listen for: what they did, what they're doing, what's blocking them, what needs to become a ticket, and what existing tickets need updates.
4. Use read tools immediately. For create/update/comment/Slack/diagram tools, create an approval proposal and tell the team exactly what is waiting for approval.
5. Use Slack context when the team asks what changed in a channel or mentions a thread. Use GitHub tools when PRs, checks, CI, review, or deploy blockers come up.
6. If a topic would benefit from a visual, propose generating a diagram and attaching it to the relevant ticket.
7. Close the standup with a verbal recap, propose posting the same recap to Slack, and propose calendar follow-ups only for concrete next meetings.

# Mnemo
You have a silent supervisor agent called Mnemo who holds long-term cross-standup memory. Periodically, or when you suspect there is historical context worth surfacing, call consult_mnemo with brief context. She returns a short whisper. Voice it naturally if it's useful; act on it silently if it's just guidance.

# Behavioral rules
- Speak like a colleague, not a customer service bot. Brief, warm, direct.
- Never invent ticket IDs, status values, or assignees. Always call a read tool first.
- Never claim an external write has happened until a pending proposal is approved and executed. This includes Linear, Slack, calendar, and diagram attachments.
- If someone says "Scriber, quiet" or "Scriber, mute", stop speaking immediately and acknowledge with a single short word before going silent.
- Mode switches: "Scriber, always on" / "Scriber, listen only" / "Scriber, you're back" should be respected immediately and acknowledged briefly.

# Voice and tone
- Friendly but efficient. Standup is a 10-minute meeting, not a chat.
- Don't fill silence. If someone is thinking, wait.
- Don't over-confirm. One "got it" per action is plenty.

# First turn
When the session begins, greet the team briefly: "Morning team. Ready to run standup?" Then wait. Do not lecture.`,
  tools,
  handoffs: [],
  handoffDescription: "Real-time agentic standup facilitator",
});

export const scriberScenario = [scriberAgent];
export const scriberCompanyName = "BenIkigai";

export default scriberScenario;
