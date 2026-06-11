import "dotenv/config";
import { mkdir } from "fs/promises";
import path from "path";
import WebSocket from "ws";
import { chromium, type BrowserContext, type Page } from "playwright-core";
import { startPcmCapture, startPcmPlayback } from "./audioPipeline";
import { boolArg, requiredArg } from "./runtimeArgs";
import type { IncomingBotBridgeMessage, OutgoingBotBridgeMessage } from "@/server/meetingBots/types";

const botId = requiredArg("bot-id", "SCRIBER_BOT_ID");
const botToken = requiredArg("token", "SCRIBER_BOT_TOKEN");
const meetingUrl = requiredArg("url", "SCRIBER_MEETING_URL");
const bridgeUrl = process.env.SCRIBER_BRIDGE_URL ?? "ws://localhost:8787";
const sampleRate = Number(process.env.SCRIBER_AUDIO_SAMPLE_RATE ?? 24_000);
const headless = boolArg("headless", "SCRIBER_MEET_HEADLESS", false);
const screenshotIntervalMs = Number(process.env.SCRIBER_SCREENSHOT_INTERVAL_MS ?? 15_000);

async function main() {
  const ws = new WebSocket(`${bridgeUrl}/ws/bots/${botId}?token=${encodeURIComponent(botToken)}`);
  await waitForBridge(ws);
  let shutdown: (code: number) => Promise<void> = async (code) => process.exit(code);

  const playback = startPcmPlayback(process.env.SCRIBER_AUDIO_PLAYBACK_COMMAND);
  ws.on("message", (data) => {
    const message = JSON.parse(data.toString()) as OutgoingBotBridgeMessage;
    if (message.type === "audio.output") {
      playback?.write(Buffer.from(message.audio, "base64"));
    }
    if (message.type === "mic.mute") {
      void setMeetMicMuted(activePage, message.muted);
    }
    if (message.type === "capture.request") {
      void captureScreenshot(activePage, ws, "Requested capture");
    }
    if (message.type === "leave") {
      void shutdown(0);
    }
  });

  const capture = startPcmCapture({
    command: process.env.SCRIBER_AUDIO_CAPTURE_COMMAND,
    sampleRate,
    onChunk: (chunk) => {
      sendBridge(ws, {
        type: "audio.input",
        audio: chunk.toString("base64"),
        sampleRate,
      });
    },
    onError: (error) => console.error("[meet/audio]", error.message),
  });

  const context = await launchContext();
  const page = await context.newPage();
  activePage = page;
  await joinGoogleMeet(page, ws);

  const captionPoll = setInterval(() => void pollCaptions(page, ws), 2_000);
  const screenshotPoll = setInterval(() => void captureScreenshot(page, ws, "Screen share"), screenshotIntervalMs);

  shutdown = async (code: number) => {
    clearInterval(captionPoll);
    clearInterval(screenshotPoll);
    capture?.stop();
    playback?.stop();
    sendBridge(ws, { type: "state.changed", status: "ended" });
    ws.close();
    await context.close().catch(() => {});
    process.exit(code);
  };

  process.on("SIGINT", () => void shutdown(0));
  process.on("SIGTERM", () => void shutdown(0));
}

let activePage: Page | null = null;
let lastCaptionText = "";

async function launchContext(): Promise<BrowserContext> {
  const executablePath = process.env.SCRIBER_CHROME_EXECUTABLE_PATH;
  if (!executablePath) {
    throw new Error("SCRIBER_CHROME_EXECUTABLE_PATH is required for Google Meet runtime");
  }

  const userDataDir =
    process.env.SCRIBER_GOOGLE_PROFILE_DIR ?? path.join(process.cwd(), ".scriber-data", "google-profile");
  await mkdir(userDataDir, { recursive: true });

  const context = await chromium.launchPersistentContext(userDataDir, {
    executablePath,
    headless,
    viewport: { width: 1280, height: 800 },
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });
  await context.grantPermissions(["camera", "microphone"], { origin: "https://meet.google.com" });
  return context;
}

async function joinGoogleMeet(page: Page, ws: WebSocket) {
  sendBridge(ws, { type: "state.changed", status: "joining" });
  await page.goto(meetingUrl, { waitUntil: "domcontentloaded" });
  await maybeFillDisplayName(page);
  await maybeClick(page, /got it|dismiss|continue without microphone and camera/i);
  await maybeClick(page, /turn off camera/i);
  await maybeClick(page, /join now|ask to join/i, 60_000);
  await sendChatMessage(page, "Scriber is listening.");
  sendBridge(ws, { type: "state.changed", status: "listening", screenShareActive: true });
}

async function maybeFillDisplayName(page: Page) {
  const inputs = await page.locator("input").all();
  for (const input of inputs) {
    const placeholder = await input.getAttribute("placeholder").catch(() => "");
    const label = await input.getAttribute("aria-label").catch(() => "");
    if (`${placeholder} ${label}`.match(/name/i)) {
      await input.fill("Scriber").catch(() => {});
      return;
    }
  }
}

async function maybeClick(page: Page, label: RegExp, timeout = 6_000) {
  const button = page.getByRole("button", { name: label }).first();
  try {
    await button.waitFor({ timeout });
    await button.click({ timeout: 2_000 });
    return true;
  } catch {
    return false;
  }
}

async function setMeetMicMuted(page: Page | null, muted: boolean) {
  if (!page) return;
  if (muted) {
    await maybeClick(page, /turn off microphone|mute/i, 1_000);
  } else {
    await maybeClick(page, /turn on microphone|unmute/i, 1_000);
  }
}

async function sendChatMessage(page: Page, text: string) {
  await maybeClick(page, /chat with everyone|chat/i, 2_000);
  const textbox = page.getByRole("textbox").last();
  try {
    await textbox.fill(text, { timeout: 2_000 });
    await page.keyboard.press("Enter");
  } catch {
    // Chat is best-effort; some meetings disable it.
  }
}

async function pollCaptions(page: Page, ws: WebSocket) {
  const text = await page
    .locator('[aria-live="polite"], [aria-live="assertive"]')
    .allTextContents()
    .catch(() => []);
  const joined = text.join(" ").replace(/\s+/g, " ").trim();
  if (!joined || joined === lastCaptionText) return;
  lastCaptionText = joined;
  sendBridge(ws, {
    type: "caption.delta",
    text: joined.slice(-1_000),
    isFinal: true,
  });
}

async function captureScreenshot(page: Page | null, ws: WebSocket, title: string) {
  if (!page) return;
  const buffer = await page.screenshot({ type: "jpeg", quality: 45 }).catch(() => null);
  if (!buffer) return;
  sendBridge(ws, {
    type: "screen.frame",
    title,
    url: `data:image/jpeg;base64,${buffer.toString("base64")}`,
    mimeType: "image/jpeg",
    metadata: {
      source: "google_meet_playwright",
      capturedAt: new Date().toISOString(),
    },
  });
}

function sendBridge(ws: WebSocket, message: IncomingBotBridgeMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function waitForBridge(ws: WebSocket) {
  await new Promise<void>((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
}

main().catch((error) => {
  console.error("[scriber/meet-runtime]", error);
  process.exit(1);
});
