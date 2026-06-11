import "dotenv/config";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import type { BotCommand, IncomingBotBridgeMessage, OutgoingBotBridgeMessage } from "@/server/meetingBots/types";
import { MeetingRealtimeBridge } from "./realtimeBridge";

const port = Number(process.env.BOT_BRIDGE_PORT ?? 8787);
const webOrigin = process.env.SCRIBER_WEB_ORIGIN ?? "http://localhost:3000";

const server = http.createServer((_, response) => {
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ ok: true, service: "scriber-bridge" }));
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/ws\/bots\/([^/]+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, match[1], url.searchParams.get("token"));
  });
});

wss.on("connection", async (ws: WebSocket, _request: http.IncomingMessage, botId: string, token: string | null) => {
  if (!token) {
    ws.close(1008, "missing token");
    return;
  }

  const postEvent = async (message: IncomingBotBridgeMessage) => {
    const response = await fetch(`${webOrigin}/api/bot-bridge/${botId}/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (response.status === 401) throw new Error("bot token rejected");
    if (!response.ok) throw new Error(`web event API returned ${response.status}`);
  };

  let realtime: MeetingRealtimeBridge | null = null;
  const realtimeEnabled = process.env.SCRIBER_DISABLE_REALTIME_BRIDGE !== "true";

  try {
    await postEvent({ type: "state.changed", status: "joining" });

    if (realtimeEnabled) {
      realtime = new MeetingRealtimeBridge({ meetingBotId: botId, botToken: token, webOrigin });
      realtime.on("outbound", (message) => sendBot(ws, message));
      realtime.on("transcript", (text, isFinal) => {
        void postEvent({ type: "assistant.message", text, isFinal }).catch((error) => console.error(error));
      });
      realtime.on("error", (error) => {
        console.error("[bridge/realtime]", error.message);
        void postEvent({ type: "state.changed", status: "error", error: error.message });
      });
      await realtime.connect();
    }

    await postEvent({ type: "state.changed", status: "listening" });
  } catch (error: any) {
    ws.close(1011, error?.message ?? "bridge setup failed");
    return;
  }

  const commandPoll = setInterval(async () => {
    try {
      const commands = await drainCommands(botId, token);
      for (const command of commands) {
        handleCommand(command, ws, realtime);
      }
    } catch (error: any) {
      console.error("[bridge/commands]", error?.message ?? error);
    }
  }, 750);

  ws.on("message", async (data) => {
    let message: IncomingBotBridgeMessage;
    try {
      message = JSON.parse(data.toString());
    } catch {
      return;
    }

    try {
      await postEvent(message);
      realtime?.handleBotMessage(message);
    } catch (error: any) {
      console.error("[bridge/message]", error?.message ?? error);
      sendBot(ws, { type: "chat.send", text: `Scriber bridge error: ${error?.message ?? "unknown"}` });
    }
  });

  ws.on("close", () => {
    clearInterval(commandPoll);
    realtime?.close();
    void postEvent({ type: "state.changed", status: "ended" }).catch(() => {});
  });
});

server.listen(port, () => {
  console.log(`[scriber/bridge] listening on ws://localhost:${port}/ws/bots/:botId`);
});

function sendBot(ws: WebSocket, message: OutgoingBotBridgeMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function drainCommands(botId: string, token: string): Promise<BotCommand[]> {
  const response = await fetch(`${webOrigin}/api/bot-bridge/${botId}/commands`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`command API returned ${response.status}`);
  const body = await response.json();
  return body.commands ?? [];
}

function handleCommand(command: BotCommand, ws: WebSocket, realtime: MeetingRealtimeBridge | null) {
  switch (command.type) {
    case "leave":
      sendBot(ws, { type: "leave" });
      ws.close(1000, "leave requested");
      break;
    case "mute":
      sendBot(ws, { type: "mic.mute", muted: true });
      break;
    case "unmute":
    case "wake":
      sendBot(ws, { type: "mic.mute", muted: false });
      if (command.type === "wake") realtime?.sendUserText("Scriber, you're back.");
      break;
    case "quiet":
      sendBot(ws, { type: "mic.mute", muted: true });
      break;
    case "capture":
      sendBot(ws, { type: "capture.request" });
      break;
    case "manual_speak":
      if (command.text) {
        realtime?.sendUserText(command.text);
        sendBot(ws, { type: "manual_speak", text: command.text });
      }
      break;
  }
}
