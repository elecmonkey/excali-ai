import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";

export const TOOL_NAME = "insertNode";

const schema = z.object({
  id: z.string(),
  label: z.string().optional(),
  type: z.enum([
    "rectangle",
    "diamond",
    "ellipse",
    "text",
    "image",
    "iframe",
    "embeddable",
    "frame",
    "magicframe",
    "freedraw",
  ]),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  relativeTo: z.string().optional(),
  placement: z.enum(["above", "below", "left", "right"]).optional(),
  meta: z.record(z.string(), z.any()).optional(),
  fileId: z.string().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
});

function placeRelative(
  elements: ExcalidrawElement[],
  relativeTo?: string,
  placement?: "above" | "below" | "left" | "right",
  width: number = 160,
  height: number = 80
) {
  if (!relativeTo) return undefined;
  const ref = elements.find((el) => el.id === relativeTo);
  if (!ref) return undefined;
  const padding = 40;
  switch (placement) {
    case "above":
      return { x: ref.x, y: ref.y - height - padding };
    case "below":
      return { x: ref.x, y: ref.y + ref.height + padding };
    case "left":
      return { x: ref.x - width - padding, y: ref.y };
    case "right":
    default:
      return { x: ref.x + ref.width + padding, y: ref.y };
  }
}

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
      output: { success: false, action: "insert-node", error: parsed.error.message },
    });
    return;
  }

  const { elements, files } = readScene(canvasOps);
  if (elements.some((el) => el.id === parsed.data.id)) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: { success: false, action: "insert-node", error: `Element ${parsed.data.id} already exists` },
    });
    return;
  }

  const el: ExcalidrawElement = {
    id: parsed.data.id,
    type: parsed.data.type,
    x: parsed.data.x ?? 0,
    y: parsed.data.y ?? 0,
    width: parsed.data.width ?? 160,
    height: parsed.data.height ?? 80,
  };

  const relPos = placeRelative(elements, parsed.data.relativeTo, parsed.data.placement, el.width, el.height);
  if (relPos) {
    el.x = relPos.x;
    el.y = relPos.y;
  }

  if (parsed.data.label && parsed.data.type === "text") {
    (el as { text: string }).text = parsed.data.label;
  }
  if (parsed.data.fileId) (el as { fileId: string }).fileId = parsed.data.fileId;
  if (parsed.data.points) (el as { points: [number, number][] }).points = parsed.data.points;
  if (parsed.data.meta) (el as { customData: Record<string, unknown> }).customData = parsed.data.meta;

  const nextElements = [...elements, el];
  writeScene(canvasOps, nextElements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "insert-node",
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
