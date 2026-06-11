import type { BotCommandType, WakeMode } from "./types";

export type WakeState = {
  wakeMode: WakeMode;
  active: boolean;
  muted: boolean;
};

export function isWakePhrase(text: string) {
  return /\bscriber\b/i.test(text);
}

export function applyWakeCommand(state: WakeState, command: BotCommandType): WakeState {
  switch (command) {
    case "quiet":
      return { ...state, active: false, muted: true, wakeMode: "listen_only" };
    case "wake":
      return { ...state, active: true, muted: false, wakeMode: "wake" };
    case "mute":
      return { ...state, muted: true };
    case "unmute":
      return { ...state, muted: false };
    default:
      return state;
  }
}

export function shouldRespondToUtterance(state: WakeState, text: string) {
  if (state.muted || state.wakeMode === "listen_only") return false;
  if (state.wakeMode === "always_on") return true;
  return state.active || isWakePhrase(text);
}

export function nextWakeStateAfterUtterance(state: WakeState, text: string): WakeState {
  if (/scriber,\s*(quiet|mute|listen only)/i.test(text)) {
    return applyWakeCommand(state, "quiet");
  }
  if (/scriber,\s*(you're back|you are back|wake|always on)/i.test(text)) {
    return { ...state, active: true, muted: false, wakeMode: "wake" };
  }
  if (isWakePhrase(text)) {
    return { ...state, active: true, muted: false };
  }
  return state;
}
