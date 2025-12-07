import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "updateNode";

const schema = z.object({
  id: z.string(),
  label: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  type: z.string().optional(),
  meta: z.record(z.string(), z.any()).optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
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
  const target = elements.find((el) => el.id === parsed.data.id) as ExcalidrawElement | undefined;
  if (!target) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: `Node ${parsed.data.id} not found`,
    });
    return;
  }

  if (parsed.data.x !== undefined) target.x = parsed.data.x;
  if (parsed.data.y !== undefined) target.y = parsed.data.y;
  if (parsed.data.width !== undefined) target.width = parsed.data.width;
  if (parsed.data.height !== undefined) target.height = parsed.data.height;
  if (parsed.data.type) target.type = parsed.data.type;
  if (parsed.data.label && target.type === "text") (target as { text?: string }).text = parsed.data.label;
  if (parsed.data.points) (target as { points?: [number, number][] }).points = parsed.data.points;
  if (parsed.data.meta) {
    (target as { customData?: Record<string, unknown> }).customData = {
      ...(target as { customData?: Record<string, unknown> }).customData,
      ...parsed.data.meta,
    };
  }

  writeScene(canvasOps, elements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "update-node",
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
