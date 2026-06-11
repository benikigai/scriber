import OpenAI from "openai";
import { promises as fs } from "fs";
import path from "path";
import { getScriberToolSpec, scriberToolSpecs } from "@/lib/scriberToolSpecs";
import { linear, defaultTeamId, resolveUserId } from "@/lib/linear";
import { attachBytesToIssue } from "@/lib/linearAttach";
import {
  createToolProposal,
  getToolProposal,
  updateToolProposal,
} from "@/server/meetingBots/store";

const MNEMO_MODEL = process.env.MNEMO_MODEL ?? "gpt-5";
const IMAGE_MODEL = process.env.IMAGE_MODEL ?? "gpt-image-1";
const DIAGRAM_STYLE_PREFIX =
  "Flat technical diagram with labeled boxes and arrows. Clean, professional. White background, dark text, single accent color. No photorealism. ";

const MNEMO_INSTRUCTIONS = `You are Mnemo, a silent supervisor agent watching a live standup meeting.
You never speak into the call. You whisper short text instructions to Scriber, the facilitator agent.

Your job:
1. Read the conversation context Scriber sends you.
2. Cross-reference it against prior standup history (provided in memory).
3. Identify ONE concrete, actionable signal Scriber should surface.

Behavioral rules:
- Respond with the literal string "PASS" if there's nothing substantive to surface.
- If you do whisper, keep it to ONE sentence.
- Never speculate. Only use what's in the provided memory and the conversation context.

Output format: either "PASS" or one sentence of whisper text. No preamble, no explanation.`;

let memoryCache: string | null = null;

async function loadMnemoMemory() {
  if (memoryCache) return memoryCache;
  memoryCache = await fs.readFile(path.join(process.cwd(), "mnemo", "memory.json"), "utf-8");
  return memoryCache;
}

async function searchLinearIssues(args: Record<string, unknown>) {
  const assigneeEmail = typeof args.assignee_email === "string" ? args.assignee_email : undefined;
  const status = typeof args.status === "string" ? args.status : undefined;
  const filter: any = {};
  if (assigneeEmail) filter.assignee = { email: { eq: assigneeEmail } };
  if (status) filter.state = { name: { eq: status } };
  const issues = await linear().issues({ filter, first: 10 });
  const out = await Promise.all(
    issues.nodes.map(async (issue) => {
      const state = await issue.state;
      const assignee = await issue.assignee;
      return {
        identifier: issue.identifier,
        title: issue.title,
        state: state?.name ?? null,
        assignee: assignee?.email ?? null,
        url: issue.url,
      };
    }),
  );
  return { issues: out };
}

async function getLinearIssue(args: Record<string, unknown>) {
  const id = String(args.id ?? "");
  if (!id) throw new Error("id required");
  const issue = await linear().issue(id);
  const state = await issue.state;
  const assignee = await issue.assignee;
  const comments = await issue.comments({ first: 5 });
  return {
    identifier: issue.identifier,
    title: issue.title,
    description: issue.description,
    state: state?.name ?? null,
    assignee: assignee?.email ?? null,
    url: issue.url,
    comments: comments.nodes.map((comment) => ({
      body: comment.body,
      createdAt: comment.createdAt,
    })),
  };
}

async function createLinearIssue(args: Record<string, unknown>) {
  const title = String(args.title ?? "").trim();
  if (!title) throw new Error("title required");
  const description = typeof args.description === "string" ? args.description : undefined;
  const priority = args.priority === undefined ? undefined : Number(args.priority);
  const teamId = await defaultTeamId();
  const result = await linear().createIssue({ teamId, title, description, priority });
  const issue = await result.issue;
  return {
    success: result.success,
    identifier: issue?.identifier,
    url: issue?.url,
    title: issue?.title,
  };
}

async function updateLinearIssue(args: Record<string, unknown>) {
  const id = String(args.id ?? "").trim();
  if (!id) throw new Error("id required");

  const issue = await linear().issue(id);
  const team = await issue.team;
  const update: any = {};
  if (typeof args.title === "string" && args.title.trim()) update.title = args.title;

  if (typeof args.state === "string" && args.state.trim() && team) {
    const states = await team.states();
    const match = states.nodes.find((state) => state.name.toLowerCase() === args.state!.toString().toLowerCase());
    if (match) update.stateId = match.id;
  }

  if (args.assignee !== undefined) {
    if (args.assignee === null || args.assignee === "") {
      update.assigneeId = null;
    } else {
      const userId = await resolveUserId(String(args.assignee));
      if (!userId) throw new Error(`assignee "${String(args.assignee)}" not found`);
      update.assigneeId = userId;
    }
  }

  if (args.priority !== undefined && args.priority !== null) {
    const priority = Number(args.priority);
    if (!Number.isInteger(priority) || priority < 0 || priority > 4) {
      throw new Error("priority must be 0..4");
    }
    update.priority = priority;
  }

  if (Object.keys(update).length === 0) throw new Error("nothing to update");
  const result = await linear().updateIssue(issue.id, update);
  return { success: result.success, identifier: id, applied: update };
}

async function commentOnLinearIssue(args: Record<string, unknown>) {
  const id = String(args.id ?? "").trim();
  const body = String(args.body ?? "").trim();
  if (!id || !body) throw new Error("id and body required");
  const issue = await linear().issue(id);
  const result = await linear().createComment({ issueId: issue.id, body });
  return { success: result.success, identifier: id };
}

async function postSlackRecap(args: Record<string, unknown>) {
  const body = String(args.body ?? "").trim();
  if (!body) throw new Error("body required");

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.log("[scriber/slack] SLACK_WEBHOOK_URL unset - recap logged only:");
    console.log(body);
    return {
      success: false,
      delivered: false,
      reason: "SLACK_WEBHOOK_URL not configured; recap logged to server stdout only",
    };
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: body }),
  });
  if (!response.ok) {
    return { success: false, delivered: false, status: response.status };
  }
  return { success: true, delivered: true };
}

async function fallbackDiagramBytes(): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(process.cwd(), "public", "fallback-diagram.png"));
  } catch {
    return null;
  }
}

async function generateDiagram(args: Record<string, unknown>) {
  const prompt = String(args.prompt ?? "").trim();
  const attachToIssue = String(args.attach_to_issue ?? "").trim();
  if (!prompt || !attachToIssue) throw new Error("prompt and attach_to_issue required");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let bytes: Buffer | null = null;
  let usedFallback = false;

  try {
    const image = await openai.images.generate({
      model: IMAGE_MODEL,
      prompt: DIAGRAM_STYLE_PREFIX + prompt,
      size: "1024x1024",
      quality: "low",
      output_format: "jpeg",
      n: 1,
    } as any);
    const b64 = image.data?.[0]?.b64_json;
    if (b64) bytes = Buffer.from(b64, "base64");
  } catch (error: any) {
    console.warn("gpt-image-1 generate failed, using fallback:", error?.message);
  }

  if (!bytes) {
    bytes = await fallbackDiagramBytes();
    usedFallback = true;
  }
  if (!bytes) throw new Error("image generation failed and no fallback available");

  const { assetUrl } = await attachBytesToIssue({
    issueIdentifier: attachToIssue,
    bytes,
    filename: usedFallback ? "diagram-fallback.png" : `diagram-${Date.now()}.jpg`,
    contentType: usedFallback ? "image/png" : "image/jpeg",
    title: prompt.slice(0, 80),
  });

  return {
    success: true,
    attached_to: attachToIssue,
    asset_url: assetUrl,
    used_fallback: usedFallback,
  };
}

async function consultMnemo(args: Record<string, unknown>) {
  const context = String(args.context ?? "").trim();
  if (!context) return { whisper: null, reason: "no context provided" };

  const memory = await loadMnemoMemory();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: MNEMO_MODEL,
    input: [
      { role: "system", content: [{ type: "input_text", text: MNEMO_INSTRUCTIONS }] },
      { role: "system", content: [{ type: "input_text", text: `Prior standup memory (JSON):\n${memory}` }] },
      {
        role: "user",
        content: [{ type: "input_text", text: `Scriber asks: ${context}\n\nWhisper one sentence or PASS.` }],
      },
    ],
    reasoning: { effort: "medium" },
  } as any);
  const text = ((response as any).output_text ?? "").trim();
  if (!text || text.toUpperCase() === "PASS") return { whisper: null };
  return { whisper: text };
}

export function realtimeToolDefinitions() {
  return scriberToolSpecs.map((spec) => ({
    type: "function",
    name: spec.name,
    description: spec.description,
    parameters: spec.parameters,
  }));
}

export async function executeScriberTool(input: {
  toolName: string;
  arguments: Record<string, unknown>;
  meetingBotId?: string | null;
  source?: "meeting" | "browser" | "api";
}) {
  const spec = getScriberToolSpec(input.toolName);
  if (!spec) throw new Error(`Unknown tool ${input.toolName}`);

  if (spec.safety === "proposal") {
    const proposal = createToolProposal({
      meetingBotId: input.meetingBotId ?? null,
      source: input.source ?? "meeting",
      toolName: spec.name,
      title: spec.approvalTitle(input.arguments),
      arguments: input.arguments,
    });
    return {
      requires_approval: true,
      proposal_id: proposal.id,
      title: proposal.title,
      status: proposal.status,
    };
  }

  switch (spec.name) {
    case "linear_search_issues":
      return searchLinearIssues(input.arguments);
    case "linear_get_issue":
      return getLinearIssue(input.arguments);
    case "consult_mnemo":
      return consultMnemo(input.arguments);
    default:
      throw new Error(`No read executor for ${spec.name}`);
  }
}

export async function approveAndExecuteToolProposal(id: string) {
  const proposal = getToolProposal(id);
  if (!proposal) throw new Error("tool proposal not found");
  if (proposal.status !== "pending") {
    return proposal;
  }

  updateToolProposal(id, { status: "approved", error: null });

  try {
    let result: unknown;
    switch (proposal.toolName) {
      case "linear_create_issue":
        result = await createLinearIssue(proposal.arguments);
        break;
      case "linear_update_issue":
        result = await updateLinearIssue(proposal.arguments);
        break;
      case "linear_add_comment":
        result = await commentOnLinearIssue(proposal.arguments);
        break;
      case "generate_diagram":
        result = await generateDiagram(proposal.arguments);
        break;
      case "post_slack_recap":
        result = await postSlackRecap(proposal.arguments);
        break;
      default:
        throw new Error(`No write executor for ${proposal.toolName}`);
    }
    return updateToolProposal(id, { status: "executed", result, error: null })!;
  } catch (error: any) {
    return updateToolProposal(id, {
      status: "failed",
      result: null,
      error: error?.message ?? "tool execution failed",
    })!;
  }
}

export function rejectToolProposal(id: string) {
  const proposal = getToolProposal(id);
  if (!proposal) throw new Error("tool proposal not found");
  if (proposal.status !== "pending") return proposal;
  return updateToolProposal(id, { status: "rejected", error: null })!;
}
