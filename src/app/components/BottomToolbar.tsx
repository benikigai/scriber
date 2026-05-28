import React from "react";
import { SessionStatus } from "@/app/types";

interface BottomToolbarProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;
  isPTTActive: boolean;
  setIsPTTActive: (val: boolean) => void;
  isPTTUserSpeaking: boolean;
  handleTalkButtonDown: () => void;
  handleTalkButtonUp: () => void;
  isEventsPaneExpanded: boolean;
  setIsEventsPaneExpanded: (val: boolean) => void;
  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (val: boolean) => void;
  codec: string;
  onCodecChange: (newCodec: string) => void;
}

function BottomToolbar({
  sessionStatus,
  onToggleConnection,
  isEventsPaneExpanded,
  setIsEventsPaneExpanded,
}: BottomToolbarProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  function getConnectionButtonLabel() {
    if (isConnected) return "End standup";
    if (isConnecting) return "Connecting…";
    return "Start standup";
  }

  function getConnectionButtonClasses() {
    const base = "text-white text-base font-medium px-6 py-3 w-44 rounded-full h-full transition-colors";
    const cursor = isConnecting ? "cursor-not-allowed" : "cursor-pointer";
    if (isConnected) return `bg-red-600 hover:bg-red-700 ${cursor} ${base}`;
    return `bg-black hover:bg-gray-800 ${cursor} ${base}`;
  }

  return (
    <div className="px-6 py-4 flex flex-row items-center justify-center gap-6 border-t border-gray-100">
      <button
        onClick={onToggleConnection}
        className={getConnectionButtonClasses()}
        disabled={isConnecting}
      >
        {getConnectionButtonLabel()}
      </button>

      <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
        <input
          id="logs"
          type="checkbox"
          checked={isEventsPaneExpanded}
          onChange={(e) => setIsEventsPaneExpanded(e.target.checked)}
          className="w-4 h-4"
        />
        Tool-call log
      </label>
    </div>
  );
}

export default BottomToolbar;
