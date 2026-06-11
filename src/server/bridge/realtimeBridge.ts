import EventEmitter from "events";
import WebSocket from "ws";
import { getScriberToolSpec } from "@/lib/scriberToolSpecs";
import type { IncomingBotBridgeMessage, OutgoingBotBridgeMessage } from "@/server/meetingBots/types";
import { realtimeToolDefinitions, executeScriberTool } from "@/server/tools/scriberToolExecutor";

type BridgeEvents = {
  outbound: [message: OutgoingBotBridgeMessage];
  transcript: [text: string, isFinal: boolean];
  error: [error: Error];
};

export class MeetingRealtimeBridge extends EventEmitter<BridgeEvents> {
  private ws: WebSocket | null = null;
  private toolArgs = new Map<string, { name: string; args: string }>();

  constructor(
    private readonly options: {
      meetingBotId: string;
      botToken: string;
      webOrigin: string;
      model?: string;
      voice?: string;
    },
  ) {
    super();
  }

  async connect() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is required for the realtime bridge");

    const model = this.options.model ?? "gpt-realtime-2";
    const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "realtime=v1",
      },
    });

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        this.ws?.off("error", onError);
        resolve();
      };
      const onError = (error: Error) => {
        this.ws?.off("open", onOpen);
        reject(error);
      };
      this.ws?.once("open", onOpen);
      this.ws?.once("error", onError);
    });

    this.ws.on("message", (data) => this.handleRealtimeMessage(data.toString()));
    this.ws.on("error", (error) => this.emit("error", error));

    this.sendRealtime({
      type: "session.update",
      session: {
        instructions: SCRIBER_MEETING_INSTRUCTIONS,
        voice: this.options.voice ?? "marin",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.55,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        },
        tools: realtimeToolDefinitions(),
        tool_choice: "auto",
      },
    });
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }

  handleBotMessage(message: IncomingBotBridgeMessage) {
    if (message.type === "audio.input") {
      this.sendRealtime({
        type: "input_audio_buffer.append",
        audio: message.audio,
      });
      return;
    }

    if (message.type === "chat.message" || message.type === "caption.delta") {
      const text = message.text.trim();
      if (!text) return;
      if (/scriber,\s*(quiet|mute|listen only)/i.test(text)) {
        this.emit("outbound", { type: "mic.mute", muted: true });
        return;
      }
      if (/scriber\b/i.test(text)) {
        this.sendUserText(text);
      }
    }
  }

  sendUserText(text: string) {
    this.sendRealtime({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    this.sendRealtime({ type: "response.create" });
  }

  private sendRealtime(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private async handleRealtimeMessage(raw: string) {
    let event: any;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    if (event.type === "response.audio.delta" && event.delta) {
      this.emit("outbound", {
        type: "audio.output",
        audio: event.delta,
        sampleRate: 24_000,
      });
      return;
    }

    if (event.type === "response.audio_transcript.done" && event.transcript) {
      this.emit("transcript", event.transcript, true);
      return;
    }

    if (event.type === "response.function_call_arguments.delta") {
      const callId = String(event.call_id ?? event.item_id ?? "");
      if (!callId) return;
      const current = this.toolArgs.get(callId) ?? {
        name: String(event.name ?? ""),
        args: "",
      };
      current.name ||= String(event.name ?? "");
      current.args += String(event.delta ?? "");
      this.toolArgs.set(callId, current);
      return;
    }

    if (event.type === "response.function_call_arguments.done") {
      await this.executeToolCall({
        callId: String(event.call_id ?? event.item_id ?? ""),
        name: String(event.name ?? this.toolArgs.get(String(event.call_id ?? event.item_id ?? ""))?.name ?? ""),
        argumentsJson: String(event.arguments ?? this.toolArgs.get(String(event.call_id ?? event.item_id ?? ""))?.args ?? "{}"),
      });
      return;
    }

    if (event.type === "response.output_item.done" && event.item?.type === "function_call") {
      await this.executeToolCall({
        callId: String(event.item.call_id ?? event.item.id ?? ""),
        name: String(event.item.name ?? ""),
        argumentsJson: String(event.item.arguments ?? "{}"),
      });
    }
  }

  private async executeToolCall(input: { callId: string; name: string; argumentsJson: string }) {
    if (!input.callId || !input.name) return;

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(input.argumentsJson || "{}");
    } catch {
      args = {};
    }

    try {
      const spec = getScriberToolSpec(input.name);
      let result: unknown;

      if (spec?.safety === "proposal") {
        result = await this.createProposalInWeb(input.name, args);
      } else {
        result = await executeScriberTool({
          toolName: input.name,
          arguments: args,
          meetingBotId: this.options.meetingBotId,
          source: "meeting",
        });
      }

      this.sendToolOutput(input.callId, result);
    } catch (error: any) {
      this.sendToolOutput(input.callId, { error: error?.message ?? "tool failed" });
    } finally {
      this.toolArgs.delete(input.callId);
    }
  }

  private async createProposalInWeb(toolName: string, args: Record<string, unknown>) {
    const response = await fetch(`${this.options.webOrigin}/api/tool-proposals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        toolName,
        arguments: args,
        meetingBotId: this.options.meetingBotId,
        source: "meeting",
      }),
    });
    if (!response.ok) {
      throw new Error(`proposal API returned ${response.status}`);
    }
    return response.json();
  }

  private sendToolOutput(callId: string, result: unknown) {
    this.sendRealtime({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    });
    this.sendRealtime({ type: "response.create" });
  }
}

const SCRIBER_MEETING_INSTRUCTIONS = `You are Scriber, a visible AI teammate inside a live Zoom or Google Meet call.

Listen silently until someone addresses you by name or the dashboard wakes you. When active, be brief and useful.
Use read tools immediately. External writes such as Linear updates, comments, Slack posts, and diagrams must create approval proposals.
Never claim an external write has happened until the proposal is approved and executed.
If someone says "Scriber, quiet" or "Scriber, mute", stop speaking and go quiet.
If you need to answer, speak in one or two short sentences unless the team asks for detail.`;
