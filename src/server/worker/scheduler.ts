import "dotenv/config";
import { spawn, type ChildProcess } from "child_process";
import type { MeetingBotRecord } from "@/server/meetingBots/types";

type MeetingBotsResponse = {
  bots?: MeetingBotRecord[];
  error?: string;
};

const webOrigin = process.env.SCRIBER_WORKER_WEB_ORIGIN ?? process.env.SCRIBER_WEB_ORIGIN ?? "http://localhost:3000";
const internalToken = process.env.SCRIBER_INTERNAL_API_TOKEN;
const pollMs = Number(process.env.SCRIBER_WORKER_POLL_MS ?? 15_000);
const launchStaged = process.env.SCRIBER_WORKER_LAUNCH_STAGED !== "false";
const running = new Map<string, ChildProcess>();

async function main() {
  console.log(`[scriber/worker] polling ${webOrigin} every ${pollMs}ms`);
  await pollOnce();
  setInterval(() => void pollOnce(), pollMs);
}

async function pollOnce() {
  try {
    const bots = await listMeetingBots();
    for (const bot of bots) {
      if (!shouldLaunch(bot)) continue;
      launchBot(bot);
    }
  } catch (error: any) {
    console.error(`[scriber/worker] ${error?.message ?? error}`);
  }
}

async function listMeetingBots() {
  const response = await fetch(`${webOrigin}/api/meeting-bots`, {
    headers: internalToken ? { Authorization: `Bearer ${internalToken}` } : undefined,
  });
  const body = (await response.json().catch(() => ({}))) as MeetingBotsResponse;
  if (!response.ok) throw new Error(body.error ?? `meeting bot API returned ${response.status}`);
  return body.bots ?? [];
}

function shouldLaunch(bot: MeetingBotRecord) {
  if (running.has(bot.id)) return false;
  if (bot.status !== "scheduled" && !(launchStaged && bot.status === "staged")) return false;
  if (!bot.joinAt) return launchStaged;
  return new Date(bot.joinAt).getTime() <= Date.now();
}

function launchBot(bot: MeetingBotRecord) {
  const script = bot.platform === "google_meet" ? "meet-runtime" : "zoom-runtime";
  const child = spawn(
    "npm",
    [
      "run",
      script,
      "--",
      "--bot-id",
      bot.id,
      "--token",
      bot.botToken,
      "--url",
      bot.meetingUrl,
    ],
    {
      env: process.env,
      stdio: "inherit",
    },
  );

  running.set(bot.id, child);
  console.log(`[scriber/worker] launched ${script} for ${bot.title} (${bot.id})`);

  child.on("exit", (code, signal) => {
    running.delete(bot.id);
    console.log(`[scriber/worker] runtime exited bot=${bot.id} code=${code ?? "null"} signal=${signal ?? "null"}`);
  });
}

main().catch((error) => {
  console.error("[scriber/worker]", error);
  process.exit(1);
});
