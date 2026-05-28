"use client";

import React, { useRef, useEffect, useState } from "react";
import { useEvent } from "@/app/contexts/EventContext";
import { LoggedEvent } from "@/app/types";

export interface EventsProps {
  isExpanded: boolean;
}

// What we surface to the demo viewer (the rest is dev-only noise)
const NOISE_PREFIXES = [
  "output_audio_buffer.delta",
  "response.audio_transcript.delta",
  "response.audio.delta",
  "response.output_audio.delta",
  "input_audio_buffer.append",
  "input_audio_buffer.committed",
  "response.output_audio_transcript.delta",
];

function classifyEvent(log: LoggedEvent): {
  category: "tool_call" | "tool_result" | "transcript" | "session" | "error" | "info" | "noise";
  label: string;
  detail?: string;
  badge?: string;
  badgeColor?: string;
} {
  const name = log.eventName || "";
  const data = log.eventData || {};

  if (NOISE_PREFIXES.some((p) => name.startsWith(p))) {
    return { category: "noise", label: name };
  }

  if (name.toLowerCase().includes("error") || data?.error || data?.response?.status_details?.error) {
    const errMsg = data?.error?.message || data?.response?.status_details?.error?.message || JSON.stringify(data?.error || {});
    return { category: "error", label: "error", detail: errMsg, badge: "ERROR", badgeColor: "bg-red-100 text-red-700" };
  }

  // Tool call arguments completed (about to execute on client)
  if (name === "response.function_call_arguments.done") {
    return {
      category: "tool_call",
      label: data.name || "tool",
      detail: data.arguments || "",
      badge: "TOOL",
      badgeColor: "bg-blue-100 text-blue-700",
    };
  }

  // Function call output sent back to model
  if (name === "conversation.item.created" && data?.item?.type === "function_call_output") {
    let output = data.item.output;
    try {
      const parsed = typeof output === "string" ? JSON.parse(output) : output;
      output = JSON.stringify(parsed, null, 2);
    } catch {
      /* keep as is */
    }
    return {
      category: "tool_result",
      label: "tool result",
      detail: typeof output === "string" ? output.slice(0, 400) : String(output),
      badge: "DONE",
      badgeColor: "bg-emerald-100 text-emerald-700",
    };
  }

  // User or assistant message item added
  if (name === "conversation.item.created" && data?.item) {
    const role = data.item.role;
    const content = data.item.content?.[0];
    const text = content?.text || content?.transcript || "";
    if (role === "user" && text) {
      return { category: "transcript", label: "user", detail: text, badge: "USER", badgeColor: "bg-gray-100 text-gray-700" };
    }
    if (role === "assistant" && text) {
      return {
        category: "transcript",
        label: "scriber",
        detail: text,
        badge: "SCRIBER",
        badgeColor: "bg-purple-100 text-purple-700",
      };
    }
  }

  // Session lifecycle
  if (name === "session.created" || name === "session.updated") {
    return { category: "session", label: name, badge: "SESSION", badgeColor: "bg-amber-100 text-amber-700" };
  }

  if (name === "response.done") {
    return { category: "info", label: "response complete", badge: "✓", badgeColor: "bg-emerald-50 text-emerald-600" };
  }

  // Everything else — useful but de-emphasized
  return { category: "info", label: name };
}

function Events({ isExpanded }: EventsProps) {
  const [prevLen, setPrevLen] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { loggedEvents, toggleExpand } = useEvent();

  useEffect(() => {
    const hasNew = loggedEvents.length > prevLen;
    if (isExpanded && hasNew && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
    setPrevLen(loggedEvents.length);
  }, [loggedEvents, isExpanded, prevLen]);

  // Drop noise events from display
  const visible = loggedEvents.filter((e) => classifyEvent(e).category !== "noise");

  return (
    <div
      className={
        (isExpanded ? "w-1/2 overflow-auto" : "w-0 overflow-hidden opacity-0") +
        " transition-all rounded-xl duration-200 ease-in-out flex-col bg-white border border-gray-100"
      }
      ref={containerRef}
    >
      {isExpanded && (
        <div>
          <div className="flex items-center justify-between px-6 py-3 sticky top-0 z-10 text-base border-b bg-white rounded-t-xl">
            <span className="font-semibold">Activity</span>
            <span className="text-xs text-gray-400">{visible.length} events</span>
          </div>
          <div>
            {visible.map((log, idx) => {
              const c = classifyEvent(log);
              const showDetail = c.detail && (log.expanded || c.category === "tool_call" || c.category === "tool_result" || c.category === "error" || c.category === "transcript");
              return (
                <div
                  key={`${log.id}-${idx}`}
                  className="border-t border-gray-100 px-4 py-2"
                >
                  <div
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    {c.badge && (
                      <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${c.badgeColor}`}>
                        {c.badge}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-800 flex-1 truncate">
                      {c.label}
                    </span>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap">
                      {log.timestamp}
                    </span>
                  </div>
                  {showDetail && c.detail && (
                    <pre className="mt-1.5 ml-1 text-xs text-gray-600 whitespace-pre-wrap break-words bg-gray-50 rounded px-2 py-1.5 max-h-32 overflow-auto">
                      {c.detail}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default Events;
