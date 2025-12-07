import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "batchUpdateNodes";

const updateSchema = z.object({
  id: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  label: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  type: z.string().optional(),
});

const schema = z.object({
  updates: z.array(updateSchema),
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

  for (const upd of parsed.data.updates) {
    const el = elements.find((e) => e.id === upd.id) as any;
    if (!el) continue;
    if (upd.x !== undefined) el.x = upd.x;
    if (upd.y !== undefined) el.y = upd.y;
    if (upd.width !== undefined) el.width = upd.width;
    if (upd.height !== undefined) el.height = upd.height;
    if (upd.type) el.type = upd.type;
    if (upd.label && el.type === "text") el.text = upd.label;
  }

  writeScene(canvasOps, elements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "batch-update-nodes",
    elements,
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
