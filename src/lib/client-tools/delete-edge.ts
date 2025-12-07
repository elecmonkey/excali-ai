import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "deleteEdge";

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
      output: { success: false, action: "delete-edge", error: parsed.error.message },
    });
    return;
  }

  const { elements, files } = readScene(canvasOps);
  const exists = elements.some((el) => el.id === parsed.data.id);
  if (!exists) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: { success: false, action: "delete-edge", error: `Edge ${parsed.data.id} not found` },
    });
    return;
  }

  const nextElements = elements.filter((el) => el.id !== parsed.data.id);
  writeScene(canvasOps, nextElements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "delete-edge",
    elements: nextElements,
    files,
  };

  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    output,
  });
}

export function matches(toolName: string) {
  return toolName === TOOL_NAME;
}
