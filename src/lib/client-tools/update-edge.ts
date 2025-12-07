import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "updateEdge";

const schema = z.object({
  id: z.string(),
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
  startArrow: z.boolean().optional(),
  endArrow: z.boolean().optional(),
  label: z.string().optional(),
  via: z.array(z.tuple([z.number(), z.number()])).optional(),
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
      output: { success: false, action: "update-edge", error: parsed.error.message },
    });
    return;
  }

  const { elements, files } = readScene(canvasOps);
  const el = elements.find((e) => e.id === parsed.data.id) as any;
  if (!el) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: { success: false, action: "update-edge", error: `Edge ${parsed.data.id} not found` },
    });
    return;
  }

  if (parsed.data.type) el.type = parsed.data.type === "line" ? "line" : "arrow";
  if (parsed.data.from) el.startBinding = { ...(el.startBinding || {}), elementId: parsed.data.from };
  if (parsed.data.to) el.endBinding = { ...(el.endBinding || {}), elementId: parsed.data.to };
  if (parsed.data.via) {
    const start = Array.isArray(el.points) && el.points.length > 0 ? el.points[0] : [0, 0];
    const end = Array.isArray(el.points) && el.points.length > 1 ? el.points[el.points.length - 1] : [100, 0];
    el.points = [start, ...parsed.data.via, end];
  }
  if (parsed.data.startArrow !== undefined) el.startArrowhead = parsed.data.startArrow ? "arrow" : null;
  if (parsed.data.endArrow !== undefined) el.endArrowhead = parsed.data.endArrow ? "arrow" : null;
  if (parsed.data.label) el.label = parsed.data.label;

  writeScene(canvasOps, elements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "update-edge",
    elements,
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
