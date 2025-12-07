import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "deleteNode";

const schema = z.object({ id: z.string() });

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

  const nextElements = elements.filter((el) => el.id !== parsed.data.id);
  // Remove edges referencing this node
  const filtered = nextElements.filter((el) => {
    if (el.type !== "arrow" && el.type !== "line") return true;
    const from = (el as any).startBinding?.elementId;
    const to = (el as any).endBinding?.elementId;
    return from !== parsed.data.id && to !== parsed.data.id;
  });

  writeScene(canvasOps, filtered, files as BinaryFiles);

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
