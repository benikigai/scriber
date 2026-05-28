"use-client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";
import Image from "next/image";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { DownloadIcon, ClipboardCopyIcon } from "@radix-ui/react-icons";
import { GuardrailChip } from "./GuardrailChip";

// ── Tool-call card helpers ──────────────────────────────────────────────────
// Tool-call breadcrumbs arrive as titles like:
//   "function call: linear_update_issue"   (start, with args in data)
//   "function call result: linear_update_issue"  (end, with result in data)
// We render each as a colored card so the demo viewer can see the agent acting.
type ToolFamily = {
  label: string;
  pillBg: string;
  pillText: string;
  cardBg: string;
  cardBorder: string;
  accent: string; // for the ring/pulse and the side bar
};

function getToolFamily(toolName: string): ToolFamily {
  if (toolName.startsWith("linear_")) {
    return {
      label: "LINEAR",
      pillBg: "bg-blue-600",
      pillText: "text-white",
      cardBg: "bg-blue-50",
      cardBorder: "border-blue-200",
      accent: "text-blue-500",
    };
  }
  if (toolName === "generate_diagram") {
    return {
      label: "DIAGRAM",
      pillBg: "bg-purple-600",
      pillText: "text-white",
      cardBg: "bg-purple-50",
      cardBorder: "border-purple-200",
      accent: "text-purple-500",
    };
  }
  if (toolName === "post_slack_recap") {
    return {
      label: "SLACK",
      pillBg: "bg-emerald-600",
      pillText: "text-white",
      cardBg: "bg-emerald-50",
      cardBorder: "border-emerald-200",
      accent: "text-emerald-500",
    };
  }
  if (toolName === "consult_mnemo") {
    return {
      label: "MNEMO",
      pillBg: "bg-amber-500",
      pillText: "text-white",
      cardBg: "bg-amber-50",
      cardBorder: "border-amber-200",
      accent: "text-amber-500",
    };
  }
  return {
    label: "TOOL",
    pillBg: "bg-gray-700",
    pillText: "text-white",
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-200",
    accent: "text-gray-500",
  };
}

function parseToolBreadcrumb(title: string): { kind: "start" | "result"; toolName: string } | null {
  const startMatch = title.match(/^function call:\s*(.+)$/i);
  if (startMatch) return { kind: "start", toolName: startMatch[1].trim() };
  const resultMatch = title.match(/^function call result:\s*(.+)$/i);
  if (resultMatch) return { kind: "result", toolName: resultMatch[1].trim() };
  return null;
}

function ToolCard({
  kind,
  toolName,
  timestamp,
  data,
}: {
  kind: "start" | "result";
  toolName: string;
  timestamp: string;
  data: Record<string, any> | undefined;
}) {
  const fam = getToolFamily(toolName);
  const isResult = kind === "result";
  return (
    <div
      className={`tool-card-enter w-full max-w-2xl rounded-lg border ${fam.cardBorder} ${fam.cardBg} ${fam.accent}`}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono ${fam.pillBg} ${fam.pillText}`}
        >
          {fam.label}
        </span>
        <span className="font-mono text-[13px] font-medium text-gray-800 flex-1 truncate">
          {toolName}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono">
          {isResult ? (
            <>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="text-emerald-600">
                <path d="M2 6.5L4.5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-emerald-700 font-semibold">done</span>
            </>
          ) : (
            <>
              <span className={`tool-dot-pulse inline-block w-1.5 h-1.5 rounded-full ${fam.accent.replace("text-", "bg-")}`} />
              <span className={`${fam.accent.replace("500", "700")} font-semibold`}>running…</span>
            </>
          )}
        </span>
        <span className="text-[10px] text-gray-400 font-mono">{timestamp}</span>
      </div>
      {data !== undefined && (
        <div className={`border-t ${fam.cardBorder} px-3 py-2`}>
          <pre className="font-mono text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap break-words max-h-48 overflow-auto">
            {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
  downloadRecording: () => void;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
  downloadRecording,
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const [justCopied, setJustCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) {
      scrollToBottom();
    }

    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  // Autofocus on text box input on load
  useEffect(() => {
    if (canSend && inputRef.current) {
      inputRef.current.focus();
    }
  }, [canSend]);

  const handleCopyTranscript = async () => {
    if (!transcriptRef.current) return;
    try {
      await navigator.clipboard.writeText(transcriptRef.current.innerText);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1500);
    } catch (error) {
      console.error("Failed to copy transcript:", error);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-white min-h-0 rounded-xl">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 text-base border-b bg-white rounded-t-xl">
          <span className="font-semibold">Transcript</span>
          <div className="flex gap-x-2">
            <button
              onClick={handleCopyTranscript}
              className="w-24 text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-x-1"
            >
              <ClipboardCopyIcon />
              {justCopied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={downloadRecording}
              className="w-40 text-sm px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 flex items-center justify-center gap-x-1"
            >
              <DownloadIcon />
              <span>Download Audio</span>
            </button>
          </div>
        </div>

        {/* Transcript Content */}
        <div
          ref={transcriptRef}
          className="overflow-auto p-4 flex flex-col gap-y-4 h-full"
        >
          {[...transcriptItems]
            .sort((a, b) => a.createdAtMs - b.createdAtMs)
            .map((item) => {
              const {
                itemId,
                type,
                role,
                data,
                expanded,
                timestamp,
                title = "",
                isHidden,
                guardrailResult,
              } = item;

            if (isHidden) {
              return null;
            }

            if (type === "MESSAGE") {
              const isUser = role === "user";
              const containerClasses = `flex justify-end flex-col ${
                isUser ? "items-end" : "items-start"
              }`;
              const bubbleBase = `max-w-lg p-3 ${
                isUser ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-black"
              }`;
              const isBracketedMessage =
                title.startsWith("[") && title.endsWith("]");
              const messageStyle = isBracketedMessage
                ? 'italic text-gray-400'
                : '';
              const displayTitle = isBracketedMessage
                ? title.slice(1, -1)
                : title;

              return (
                <div key={itemId} className={containerClasses}>
                  <div className="max-w-lg">
                    <div
                      className={`${bubbleBase} rounded-t-xl ${
                        guardrailResult ? "" : "rounded-b-xl"
                      }`}
                    >
                      <div
                        className={`text-xs ${
                          isUser ? "text-gray-400" : "text-gray-500"
                        } font-mono`}
                      >
                        {timestamp}
                      </div>
                      <div className={`whitespace-pre-wrap ${messageStyle}`}>
                        <ReactMarkdown>{displayTitle}</ReactMarkdown>
                      </div>
                    </div>
                    {guardrailResult && (
                      <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
                        <GuardrailChip guardrailResult={guardrailResult} />
                      </div>
                    )}
                  </div>
                </div>
              );
            } else if (type === "BREADCRUMB") {
              const toolMeta = parseToolBreadcrumb(title);
              if (toolMeta) {
                return (
                  <div key={itemId} className="flex justify-start">
                    <ToolCard
                      kind={toolMeta.kind}
                      toolName={toolMeta.toolName}
                      timestamp={timestamp}
                      data={data}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={itemId}
                  className="flex flex-col justify-start items-start text-gray-500 text-sm"
                >
                  <span className="text-xs font-mono">{timestamp}</span>
                  <div
                    className={`whitespace-pre-wrap flex items-center font-mono text-sm text-gray-800 ${
                      data ? "cursor-pointer" : ""
                    }`}
                    onClick={() => data && toggleTranscriptItemExpand(itemId)}
                  >
                    {data && (
                      <span
                        className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${
                          expanded ? "rotate-90" : "rotate-0"
                        }`}
                      >
                        ▶
                      </span>
                    )}
                    {title}
                  </div>
                  {expanded && data && (
                    <div className="text-gray-800 text-left">
                      <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              );
            } else {
              // Fallback if type is neither MESSAGE nor BREADCRUMB
              return (
                <div
                  key={itemId}
                  className="flex justify-center text-gray-500 text-sm italic font-mono"
                >
                  Unknown item type: {type}{" "}
                  <span className="ml-2 text-xs">{timestamp}</span>
                </div>
              );
            }
          })}
        </div>
      </div>

      <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-gray-200">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) {
              onSendMessage();
            }
          }}
          className="flex-1 px-4 py-2 focus:outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="bg-gray-900 text-white rounded-full px-2 py-2 disabled:opacity-50"
        >
          <Image src="arrow.svg" alt="Send" width={24} height={24} />
        </button>
      </div>
    </div>
  );
}

export default Transcript;
