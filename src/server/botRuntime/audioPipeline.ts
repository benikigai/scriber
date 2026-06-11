import { spawn, type ChildProcessByStdio } from "child_process";
import type { Readable, Writable } from "stream";

export type PcmCapture = {
  stop: () => void;
};

export type PcmPlayback = {
  write: (audio: Buffer) => void;
  stop: () => void;
};

function splitCommand(command: string) {
  const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
  return parts.map((part) => part.replace(/^["']|["']$/g, ""));
}

export function startPcmCapture(options: {
  command?: string;
  sampleRate: number;
  onChunk: (chunk: Buffer) => void;
  onError?: (error: Error) => void;
}): PcmCapture | null {
  if (!options.command) return null;
  const [bin, ...args] = splitCommand(options.command);
  if (!bin) return null;

  const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", (chunk: Buffer) => options.onChunk(chunk));
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) console.warn(`[scriber/audio-capture] ${text}`);
  });
  child.on("error", (error) => options.onError?.(error));

  return {
    stop: () => child.kill("SIGTERM"),
  };
}

export function startPcmPlayback(command?: string): PcmPlayback | null {
  if (!command) return null;
  const [bin, ...args] = splitCommand(command);
  if (!bin) return null;

  const child: ChildProcessByStdio<Writable, null, Readable> = spawn(bin, args, {
    stdio: ["pipe", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) console.warn(`[scriber/audio-playback] ${text}`);
  });

  return {
    write: (audio: Buffer) => {
      if (!child.killed) child.stdin.write(audio);
    },
    stop: () => child.kill("SIGTERM"),
  };
}
