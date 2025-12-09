"use client";

import { useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DslBadge } from "./DslBadge";

type Message = {
  id: string;
  role: "user" | "assistant";
  parts: any[];
};

interface MessageBubbleProps {
  message: Message;
  isLoading: boolean;
  displayText: (text: string) => string;
  extractDsl: (text: string) => string;
  renderToolPart: (p: any, idx: number) => ReactNode;
  onRestoreSnapshot: (id: string) => void;
}

export function MessageBubble({
  message,
  isLoading,
  displayText,
  extractDsl,
  renderToolPart,
  onRestoreSnapshot,
}: MessageBubbleProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);

  const textParts = useMemo(
    () => message.parts.filter((part) => (part as any).type === "text") as any[],
    [message.parts]
  );
  const firstText = textParts[0]?.text as string | undefined;
  const dslSnippet = firstText ? extractDsl(firstText) : "";
  const isOverlapFeedback = firstText?.startsWith("[OVERLAP_FEEDBACK]");

  const handleRestoreClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setConfirmPos({ top: rect.top, left: rect.left });
    setConfirming(true);
  };

  const bubble = (
    <div
      className={`max-w-[95%] w-fit rounded-lg ${
        isOverlapFeedback
          ? "bg-transparent shadow-none p-0 text-primary"
          : "px-4 py-2 " +
            (message.role === "user"
              ? "bg-blue-500 text-white"
              : "bg-muted text-primary")
      }`}
    >
      {message.parts.map((part, idx) => {
        const p = part as any;

        if (p.type === "text") {
          const text = p.text as string;
          if (text.startsWith("[OVERLAP_FEEDBACK]")) {
            const lines = text.split("\n").slice(1);
            return (
              <div
                key={idx}
                className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-md p-2 space-y-1"
              >
                <div className="font-medium">⚠️ Overlap detected</div>
                {lines.map((l: string, i: number) => (
                  <div key={i}>{l.replace(/^- /, "")}</div>
                ))}
              </div>
            );
          }
          return (
            <p key={idx} className="text-sm whitespace-pre-wrap break-words">
              {displayText(text)}
            </p>
          );
        }

        return renderToolPart(p, idx);
      })}
    </div>
  );

  return (
    <div
      className={`flex ${
        isOverlapFeedback ? "justify-start" : message.role === "user" ? "justify-end" : "justify-start"
      }`}
    >
      {message.role === "user" && !isOverlapFeedback ? (
        <div className="flex items-start gap-2">
          {dslSnippet ? (
            <div className="flex flex-col items-center gap-1 relative">
              <DslBadge dsl={dslSnippet} />
              <button
                type="button"
                onClick={handleRestoreClick}
                disabled={isLoading}
                className="h-4 w-4 rounded-full bg-muted text-red-500 text-[10px] flex items-center justify-center border border-muted hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Restore to this message snapshot"
              >
                ↺
              </button>
              {confirming && confirmPos &&
                createPortal(
                  <div
                    className="fixed z-9999 bg-surface text-primary border border-muted rounded-md shadow-lg p-2 text-xs space-y-2"
                    style={{
                      top: confirmPos.top,
                      left: confirmPos.left,
                      transform: "translate(-110%, 0)",
                    }}
                  >
                    <div>Restore canvas to this snapshot? Current edits will be overwritten.</div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onRestoreSnapshot(message.id);
                          setConfirming(false);
                        }}
                        className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(false)}
                        className="px-2 py-1 rounded bg-muted text-primary text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          ) : null}
          {bubble}
        </div>
      ) : (
        bubble
      )}
    </div>
  );
}
