import "dotenv/config";
import WebSocket from "ws";
import { requiredArg } from "./runtimeArgs";
import type { IncomingBotBridgeMessage, OutgoingBotBridgeMessage } from "@/server/meetingBots/types";

const botId = requiredArg("bot-id", "SCRIBER_BOT_ID");
const botToken = requiredArg("token", "SCRIBER_BOT_TOKEN");
const meetingUrl = requiredArg("url", "SCRIBER_MEETING_URL");
const bridgeUrl = process.env.SCRIBER_BRIDGE_URL ?? "ws://localhost:8787";

async function main() {
  const ws = new WebSocket(`${bridgeUrl}/ws/bots/${botId}?token=${encodeURIComponent(botToken)}`);
  await waitForBridge(ws);

  sendBridge(ws, {
    type: "state.changed",
    status: "staged",
    error:
      "Zoom native adapter boundary is ready. Wire Zoom Meeting SDK raw audio/video callbacks to this process.",
  });

  console.log("[scriber/zoom-runtime] adapter contract ready");
  console.log(`[scriber/zoom-runtime] meeting: ${meetingUrl}`);
  console.log("[scriber/zoom-runtime] expected native callbacks:");
  console.log("  - mixed/per-participant PCM -> send audio.input");
  console.log("  - chat/captions -> send chat.message or caption.delta");
  console.log("  - screen share frames -> send screen.frame");
  console.log("  - bridge audio.output -> write to Zoom external audio source");

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString()) as OutgoingBotBridgeMessage;
    if (message.type === "audio.output") {
      console.log(`[scriber/zoom-runtime] audio.output ${message.audio.length} base64 chars @ ${message.sampleRate}Hz`);
    }
    if (message.type === "mic.mute") {
      console.log(`[scriber/zoom-runtime] mic.mute ${message.muted}`);
    }
    if (message.type === "capture.request") {
      console.log("[scriber/zoom-runtime] capture.request");
    }
    if (message.type === "leave") {
      process.exit(0);
    }
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
  console.error("[scriber/zoom-runtime]", error);
  process.exit(1);
});
