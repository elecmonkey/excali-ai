"use client";

import { useState, FormEvent, useEffect, useRef, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useExcalidrawContext } from "@/lib/excalidraw-context";
import {
  executeAutoTool,
  confirmReplaceDiagram,
  rejectReplaceDiagram,
  applyToolResultToCanvas,
  TOOL_NAMES,
  type MermaidToolResult,
} from "@/lib/client-tools";
import { readScene } from "@/lib/client-tools/scene-utils";
import { jsonToDsl } from "@/lib/dsl/json-mapper";
import { serializeDSL } from "@/lib/dsl/serializer";

export default function AIChatSidebar() {
  const { updateScene, clearScene, getExcalidrawAPI, scene } = useExcalidrawContext();
  const [inputValue, setInputValue] = useState("");
  const processedOutputs = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Canvas operations for tool execution
  const canvasOps = useCallback(
    () => ({
      clearScene,
      updateScene,
      getExcalidrawAPI,
    }),
    [clearScene, updateScene, getExcalidrawAPI]
  );

  const { messages, sendMessage, addToolOutput, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    
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
        addToolOutput,
        canvasEmpty,
        canvasOps()
      );
    },
  });

  // Check if we're actually waiting for something
  const hasWaitingReplaceConfirmation = messages.some(msg => 
    msg.role === "assistant" && 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      await confirmReplaceDiagram(toolCallId, mermaidSyntax, addToolOutput, canvasOps());
    },
    [addToolOutput, canvasOps]
  );

  // Handle user rejection for replace
  const handleRejectReplace = useCallback(
    (toolCallId: string) => {
      rejectReplaceDiagram(toolCallId, addToolOutput);
    },
    [addToolOutput]
  );

  // Apply tool outputs to Excalidraw canvas
  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.role !== "assistant") return;

      msg.parts.forEach((part) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dsl = serializeDSL(jsonToDsl({ elements: elements as any, files, appState: {} }));
    const withContext = `${message}\n\n[CURRENT_DIAGRAM_DSL]\n${dsl}`;
    await sendMessage({ text: withContext });
  };

  const displayText = (text: string) => {
    const marker = "\n\n[CURRENT_DIAGRAM_DSL]";
    const idx = text.indexOf(marker);
    return idx === -1 ? text : text.slice(0, idx);
  };

  // Render tool part based on type and state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          const mermaidSyntax = p.input?.mermaid;
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

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          AI Assistant
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Ask me to help with your diagram
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {msg.parts.map((part, idx) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const p = part as any;

                if (p.type === "text") {
                  return (
                    <p key={idx} className="text-sm whitespace-pre-wrap">
                      {displayText(p.text)}
                    </p>
                  );
                }

                return renderToolPart(p, idx);
              })}
            </div>
          </div>
        ))}
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
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Describe the diagram you want..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
