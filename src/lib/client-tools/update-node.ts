import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { tryRedrawBoundText } from "./text-layout";

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

  const oldX = target.x as number;
  const oldY = target.y as number;

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

  // Move bound text with container if position changed
  const moved = parsed.data.x !== undefined || parsed.data.y !== undefined;
  if (moved) {
    const dx = (target.x as number) - oldX;
    const dy = (target.y as number) - oldY;
    const toRedraw: { text: any; container: any }[] = [];
    for (const el of elements) {
      if (el.type === "text" && (el as any).containerId === target.id) {
        const width = (el as any).width as number | undefined;
        const height = (el as any).height as number | undefined;
        if (width !== undefined && height !== undefined) {
          el.x = (target.x as number) + ((target.width as number) - width) / 2;
          el.y = (target.y as number) + ((target.height as number) - height) / 2;
          toRedraw.push({ text: el, container: target });
        } else {
          el.x = (el.x as number) + dx;
          el.y = (el.y as number) + dy;
        }
      }
    }
    if (toRedraw.length) {
      for (const { text, container } of toRedraw) {
        await tryRedrawBoundText(text, container, elements);
      }
    }
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
