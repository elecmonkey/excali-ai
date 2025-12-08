"use client";

import { useState, FormEvent, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useExcalidrawContext } from "@/lib/excalidraw-context";
import {
  executeAutoTool,
  confirmReplaceDiagram,
  rejectReplaceDiagram,
  applyToolResultToCanvas,
  TOOL_NAMES,
  type MermaidToolResult,
} from "@/lib/client-tools";
import { AddToolOutputFn } from "@/lib/client-tools/types";
import { readScene } from "@/lib/client-tools/scene-utils";
import { jsonToDsl } from "@/lib/dsl/json-mapper";
import { serializeDSL } from "@/lib/dsl/serializer";
import { detectOverlaps } from "@/lib/geometry/overlap";

function DslBadge({ dsl }: { dsl: string }) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const onEnter = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.top, left: rect.left });
    }
    setVisible(true);
  };

  const onLeave = () => {
    hideTimer.current = window.setTimeout(() => setVisible(false), 500);
  };

  return (
    <div className="relative flex items-start">
      <button
        aria-label="Show DSL snapshot"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        ref={btnRef}
        className="h-4 w-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[9px] flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-200"
      >
        D
      </button>
      {pos &&
        createPortal(
          <div
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            className={`fixed bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-64 w-72 overflow-auto p-3 text-xs whitespace-pre-wrap z-[9999] transition-opacity duration-200 ${
              visible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-100%, 0)",
            }}
          >
            {dsl}
          </div>,
          document.body
        )}
    </div>
  );
}

export default function AIChatSidebar() {
  const { updateScene, clearScene, getExcalidrawAPI, scene } = useExcalidrawContext();
  const [inputValue, setInputValue] = useState("");
  const processedOutputs = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastOverlapHash = useRef<string>("");
  const messageSnapshots = useRef<Map<string, { elements: any[]; files: any }>>(new Map());
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);

  // Canvas operations for tool execution
  const canvasOps = useCallback(
    () => ({
      clearScene,
      updateScene,
      getExcalidrawAPI,
    }),
    [clearScene, updateScene, getExcalidrawAPI]
  );

  const { messages, sendMessage, addToolOutput, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    
    // Auto-execute client-side tools (except those requiring confirmation)
    async onToolCall({ toolCall }) {
      // Check if canvas is empty by examining current scene
      const canvasEmpty = !scene.elements || scene.elements.length === 0;

      await executeAutoTool(
        {
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input,
          dynamic: toolCall.dynamic,
        },
        addToolOutput as unknown as AddToolOutputFn,
        canvasEmpty,
        canvasOps()
      );
    },
  });

  // Check if we're actually waiting for something
  const hasWaitingReplaceConfirmation = messages.some(msg => 
    msg.role === "assistant" &&
    msg.parts.some((p: any) => 
      p.type === `tool-${TOOL_NAMES.REPLACE_DIAGRAM}` && 
      p.state === "input-available"
    )
  );

  // Don't show loading if we're waiting for user confirmation
  const isLoading = (status === "streaming" || status === "submitted") && !hasWaitingReplaceConfirmation;

  // Handle user confirmation for replace
  const handleConfirmReplace = useCallback(
    async (toolCallId: string, mermaidSyntax: string) => {
      await confirmReplaceDiagram(
        toolCallId,
        mermaidSyntax,
        addToolOutput as unknown as AddToolOutputFn,
        canvasOps()
      );
    },
    [addToolOutput, canvasOps]
  );

  // Handle user rejection for replace
  const handleRejectReplace = useCallback(
    (toolCallId: string) => {
      rejectReplaceDiagram(toolCallId, addToolOutput as unknown as AddToolOutputFn);
    },
    [addToolOutput]
  );

  // Apply tool outputs to Excalidraw canvas
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.role !== "assistant") return;

      msg.parts.forEach((part) => {
        const p = part as any;
        const isCreateTool = p.type === `tool-${TOOL_NAMES.CREATE_DIAGRAM}`;
        const isReplaceTool = p.type === `tool-${TOOL_NAMES.REPLACE_DIAGRAM}`;

        const hasElements = p.output?.elements;

        if ((isCreateTool || isReplaceTool || hasElements) && p.state === "output-available") {
          const outputId = `${p.toolCallId}-output`;
          if (processedOutputs.current.has(outputId)) return;
          processedOutputs.current.add(outputId);

          const output = p.output as MermaidToolResult;
          if (output?.success && output?.elements) {
            applyToolResultToCanvas(output, canvasOps());
          }
        }
      });
    });
  }, [messages, canvasOps]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const message = inputValue;
    setInputValue("");
    // Attach current scene DSL as inline context to help the model reference ids
    const { elements, files } = readScene(canvasOps());
    const dsl = serializeDSL(jsonToDsl({ elements: elements as any, files, appState: {} }));
    const withContext = `${message}\n\n[CURRENT_DIAGRAM_DSL]\n${dsl}`;
    await sendMessage({ text: withContext });
  };

  const displayText = (text: string) => {
    const marker = "\n\n[CURRENT_DIAGRAM_DSL]";
    const idx = text.indexOf(marker);
    return idx === -1 ? text : text.slice(0, idx);
  };

  const extractDsl = (text: string) => {
    const marker = "\n\n[CURRENT_DIAGRAM_DSL]";
    const idx = text.indexOf(marker);
    return idx === -1 ? "" : text.slice(idx + marker.length).trim();
  };

  const hashScene = (elements: any[]) => {
    const sig = elements
      .map((el) => `${el.id || ""}:${el.versionNonce || el.version || ""}:${el.x}:${el.y}`)
      .sort()
      .join("|");
    return sig;
  };

  // Auto overlap feedback after assistant turn completes
  useEffect(() => {
    if (status !== "ready") return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    // Skip if assistant still has streaming/pending parts
    const pending = lastAssistant.parts.some((part: any) =>
      part.state === "input-streaming" || part.state === "input-available" || part.state === "output-streaming"
    );
    if (pending) return;

    const hash = hashScene(scene.elements as any[]);
    if (hash === lastOverlapHash.current) return;
    lastOverlapHash.current = hash;

    const overlaps = detectOverlaps(scene.elements as any[]);
    if (!overlaps.length) return;

    const lines = overlaps.map(
      (o) => `- a: ${o.a}, b: ${o.b}, ratio: ${o.overlapRatio.toFixed(2)}, area: ${o.overlapArea.toFixed(1)}`
    );
    void sendMessage({
      text: `[OVERLAP_FEEDBACK]\n` +
        `Detected overlaps. Please compute geometry and move nodes so shapes do not intersect (leave a gap); avoid repeating the same coordinates. If many overlaps remain, you may call the autoLayout tool (force-directed) to separate nodes, then fine-tune manually.\n` +
        `${lines.join("\n")}`,
    });
  }, [messages, scene.elements, status, sendMessage]);

  // Capture scene snapshot for new user messages (approximate send-time)
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.role !== "user") return;
      if (messageSnapshots.current.has(msg.id)) return;
      const { elements, files } = readScene(canvasOps());
      messageSnapshots.current.set(msg.id, { elements: elements as any[], files });
    });
  }, [messages, canvasOps]);

  const handleRestoreSnapshot = useCallback(
    (msgId: string) => {
      const snap = messageSnapshots.current.get(msgId);
      if (!snap) return;
      updateScene(snap.elements, snap.files);
    },
    [updateScene]
  );

  // Render tool part based on type and state
  const renderToolPart = (p: any, idx: number) => {
    // Create diagram tool
    if (p.type === `tool-${TOOL_NAMES.CREATE_DIAGRAM}`) {
      switch (p.state) {
        case "input-streaming":
          return (
            <div key={idx} className="text-xs text-blue-500 dark:text-blue-400 italic my-2">
              🔄 Generating Mermaid syntax...
            </div>
          );
        case "input-available":
          return (
            <div key={idx} className="text-xs text-blue-500 dark:text-blue-400 italic my-2">
              🎨 Creating diagram...
            </div>
          );
        case "output-available":
          if (p.output?.success) {
            return (
              <div key={idx} className="text-xs text-green-600 dark:text-green-400 italic my-2">
                ✅ Diagram created
              </div>
            );
          } else {
            return (
              <div key={idx} className="text-xs text-red-600 dark:text-red-400 my-2">
                ❌ Failed: {p.output?.error || "Unknown error"}
              </div>
            );
          }
        case "output-error":
          return (
            <div key={idx} className="text-xs text-red-600 dark:text-red-400 my-2">
              ❌ Failed: {p.errorText}
            </div>
          );
      }
    }

    // Replace diagram tool (requires confirmation)
    if (p.type === `tool-${TOOL_NAMES.REPLACE_DIAGRAM}`) {
      const callId = p.toolCallId;

      switch (p.state) {
        case "input-streaming":
          return (
            <div key={idx} className="text-xs text-blue-500 dark:text-blue-400 italic my-2">
              🔄 Generating Mermaid syntax...
            </div>
          );
        case "input-available": {
          const mermaidSyntax = p.input?.mermaid ?? p.input?.mermaidCode;
          if (!mermaidSyntax) {
            return (
              <div key={idx} className="text-xs text-red-600 dark:text-red-400 my-2">
                ❌ Error: No Mermaid syntax received
              </div>
            );
          }

          return (
            <div
              key={idx}
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 my-2"
            >
              <div className="text-sm text-amber-900 dark:text-amber-100 font-medium mb-2">
                ⚠️ Confirm Replace?
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                This will clear all content on canvas and replace with new diagram
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirmReplace(callId, mermaidSyntax)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-500 rounded hover:bg-blue-600 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleRejectReplace(callId)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-700 rounded hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        }
        case "output-available":
          if (!p.output?.userConfirmed) {
            return (
              <div key={idx} className="text-xs text-zinc-500 dark:text-zinc-400 italic my-2">
                🚫 Cancelled
              </div>
            );
          } else if (p.output?.success) {
            return (
              <div key={idx} className="text-xs text-green-600 dark:text-green-400 italic my-2">
                ✅ Diagram replaced
              </div>
            );
          } else {
            return (
              <div key={idx} className="text-xs text-red-600 dark:text-red-400 my-2">
                ❌ Failed: {p.output?.error || "Unknown error"}
              </div>
            );
          }
        case "output-error":
          return (
            <div key={idx} className="text-xs text-red-600 dark:text-red-400 my-2">
              ❌ Failed: {p.errorText}
            </div>
          );
      }
    }

    // Generic tools (node/edge ops)
    if (p.type?.startsWith("tool-") && p.state === "output-available" && p.output) {
      const ok = p.output?.success;
      const msg = p.output?.message || (ok ? "Done" : p.output?.error || "Failed");
      return (
        <div key={idx} className={`text-xs my-2 ${ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {ok ? "✅" : "❌"} {msg}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Chat with AI Assistant
        </h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const textParts = msg.parts.filter((part) => (part as any).type === "text") as any[];
          const firstText = textParts[0]?.text as string | undefined;
          const dslSnippet = firstText ? extractDsl(firstText) : "";
          const isOverlapFeedback = firstText?.startsWith("[OVERLAP_FEEDBACK]");
          const bubble = (
            <div
              className={`max-w-[95%] w-fit rounded-lg ${
                isOverlapFeedback
                  ? "bg-transparent shadow-none p-0 text-zinc-900 dark:text-zinc-100"
                  : "px-4 py-2 " +
                    (msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100")
              }`}
            >
              {msg.parts.map((part, idx) => {
                const p = part as any;

                if (p.type === "text") {
                  const text = p.text as string;
                  if (text.startsWith("[OVERLAP_FEEDBACK]")) {
                    const lines = text.split("\n").slice(1);
                    return (
                      <div
                        key={idx}
                        className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-600 rounded-md p-2 space-y-1"
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
              key={msg.id}
              className={`flex ${
                isOverlapFeedback ? "justify-start" : msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "user" ? (
                <div className="flex items-start gap-2">
                  {dslSnippet && !isOverlapFeedback ? (
                    <div className="flex flex-col items-center gap-1 relative">
                      <DslBadge dsl={dslSnippet} />
                      <button
                        type="button"
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setConfirmPos({ top: rect.top, left: rect.left });
                          setConfirmTarget(msg.id);
                        }}
                        disabled={isLoading}
                        className="h-4 w-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-red-500 dark:text-red-300 text-[10px] flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Restore to this message snapshot"
                      >
                        ↺
                      </button>
                      {confirmTarget === msg.id && confirmPos &&
                        createPortal(
                          <div
                            className="fixed z-9999 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-md shadow-lg p-2 text-xs space-y-2"
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
                                  handleRestoreSnapshot(msg.id);
                                  setConfirmTarget(null);
                                }}
                                className="px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmTarget(null)}
                                className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 text-xs"
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
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                Thinking...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe the diagram you want..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => stop()}
              disabled={!isLoading}
              className="px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="停止输出"
            >
              ✕
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
