"use client";

import { useEffect, useRef } from "react";
import { ChatHeader } from "./ai-chat-sidebar/ChatHeader";
import { ChatInput } from "./ai-chat-sidebar/ChatInput";
import { LoadingIndicator } from "./ai-chat-sidebar/LoadingIndicator";
import { MessageBubble } from "./ai-chat-sidebar/MessageBubble";
import { useChatSidebar, useOverlapFeedback } from "./ai-chat-sidebar/hooks";
import { TOOL_NAMES } from "@/lib/client-tools";

export default function AIChatSidebar() {
  const {
    messages,
    status,
    isLoading,
    inputValue,
    setInputValue,
    displayText,
    extractDsl,
    handleSubmit,
    stop,
    handleRestoreSnapshot,
    handleConfirmReplace,
    handleRejectReplace,
    scene,
    sendMessageRef,
  } = useChatSidebar();
  useOverlapFeedback(
    scene,
    async (args) => {
      if (sendMessageRef.current) {
        await sendMessageRef.current(args);
      }
    },
    status
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg as any}
            isLoading={isLoading}
            displayText={displayText}
            extractDsl={extractDsl}
            renderToolPart={renderToolPart}
            onRestoreSnapshot={handleRestoreSnapshot}
          />
        ))}
        {isLoading && <LoadingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        inputValue={inputValue}
        setInputValue={setInputValue}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        onStop={stop}
      />
    </div>
  );
}
