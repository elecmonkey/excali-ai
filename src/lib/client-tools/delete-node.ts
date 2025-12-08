import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "deleteNode";

const schema = z.object({
  id: z.string(),
  removeEdges: z.boolean().optional(),
});

export async function execute(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutputFn,
  canvasOps?: CanvasOps
) {
  const parsed = schema.safeParse(toolCall.input);
  if (!parsed.success) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: parsed.error.message,
    });
    return;
  }

  const { elements, files } = readScene(canvasOps);
  const exists = elements.some((el) => el.id === parsed.data.id);
  if (!exists) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: `Node ${parsed.data.id} not found`,
    });
    return;
  }

  const removeEdges = parsed.data.removeEdges === true;

  const toRemove = new Set<string>();
  toRemove.add(parsed.data.id);

  // Remove bound text for the node
  for (const el of elements) {
    if (el.type === "text" && (el as any).containerId === parsed.data.id) {
      toRemove.add(el.id as string);
    }
  }

  if (removeEdges) {
    // Also remove edges referencing the node
    for (const el of elements) {
      if (el.type !== "arrow" && el.type !== "line") continue;
      const from = (el as any).startBinding?.elementId;
      const to = (el as any).endBinding?.elementId;
      if (from === parsed.data.id || to === parsed.data.id) {
        toRemove.add(el.id as string);
      }
    }
    // Remove labels bound to those edges
    for (const el of elements) {
      if (el.type === "text" && toRemove.has((el as any).containerId)) {
        toRemove.add(el.id as string);
      }
    }
  }

  const filtered = elements.filter((el) => !toRemove.has(el.id as string));

  // Clean up orphan texts whose container no longer exists (but keep edge labels since edge ids remain)
  const remainingIds = new Set(filtered.map((el) => el.id as string));
  const finalElements = filtered.filter((el) => {
    if (el.type !== "text") return true;
    const containerId = (el as any).containerId as string | undefined;
    if (!containerId) return true;
    return remainingIds.has(containerId);
  });

  writeScene(canvasOps, finalElements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "delete-node",
    elements: filtered,
    files,
  };

  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    state: "output-available",
    output,
  });
}

export function matches(toolName: string) {
  return toolName === TOOL_NAME;
}
