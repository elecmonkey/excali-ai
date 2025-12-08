"use client";

import { useCallback, useEffect, useMemo, useRef, useState, FormEvent } from "react";
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
import { useDslContextInjection } from "./use-dsl-context-injection";
import { useRestoreSnapshot } from "./use-restore-snapshot";

export function useChatSidebar() {
  const { updateScene, clearScene, getExcalidrawAPI, scene } = useExcalidrawContext();
  const [inputValue, setInputValue] = useState("");
  const processedOutputs = useRef<Set<string>>(new Set());
  const messageSnapshots = useRef<Map<string, { elements: any[]; files: any }>>(new Map());
  const sendMessageRef = useRef<(args: { text: string }) => Promise<void> | undefined>(undefined);

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
    async onToolCall({ toolCall }) {
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

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const hasWaitingReplaceConfirmation = useMemo(
    () =>
      messages.some(
        (msg) =>
          msg.role === "assistant" &&
          msg.parts.some(
            (p: any) => p.type === `tool-${TOOL_NAMES.REPLACE_DIAGRAM}` && p.state === "input-available"
          )
      ),
    [messages]
  );

  const isLoading = (status === "streaming" || status === "submitted") && !hasWaitingReplaceConfirmation;

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

  const handleRejectReplace = useCallback(
    (toolCallId: string) => {
      rejectReplaceDiagram(toolCallId, addToolOutput as unknown as AddToolOutputFn);
    },
    [addToolOutput]
  );

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

  const { displayText, extractDsl, buildMessageWithContext } = useDslContextInjection(canvasOps);

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.role !== "user") return;
      if (messageSnapshots.current.has(msg.id)) return;
      const { elements, files } = readScene(canvasOps());
      messageSnapshots.current.set(msg.id, { elements: elements as any[], files });
    });
  }, [messages, canvasOps]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim() || isLoading) return;
      const withContext = buildMessageWithContext(inputValue);
      setInputValue("");
      await sendMessage({ text: withContext });
    },
    [inputValue, isLoading, buildMessageWithContext, sendMessage]
  );

  const handleRestoreSnapshot = useCallback(
    (msgId: string) => {
      const snap = messageSnapshots.current.get(msgId);
      if (!snap) return;
      updateScene(snap.elements, snap.files);
    },
    [updateScene]
  );

  return {
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
  };
}
