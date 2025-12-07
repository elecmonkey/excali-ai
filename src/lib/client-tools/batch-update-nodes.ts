import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { tryRedrawBoundText } from "./text-layout";

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

  const originalPos = new Map<string, { x: number; y: number }>();

  for (const upd of parsed.data.updates) {
    const el = elements.find((e) => e.id === upd.id) as any;
    if (!el) continue;
    if ((upd.x !== undefined || upd.y !== undefined) && !originalPos.has(upd.id)) {
      originalPos.set(upd.id, { x: el.x as number, y: el.y as number });
    }
    if (upd.x !== undefined) el.x = upd.x;
    if (upd.y !== undefined) el.y = upd.y;
    if (upd.width !== undefined) el.width = upd.width;
    if (upd.height !== undefined) el.height = upd.height;
    if (upd.type) el.type = upd.type;
    if (upd.label && el.type === "text") el.text = upd.label;
  }

  // Move bound text with updated containers
  const toRedraw: { text: any; container: any }[] = [];
  for (const [id, old] of originalPos.entries()) {
    const updated = elements.find((e) => e.id === id) as any;
    if (!updated) continue;
    const dx = (updated.x as number) - old.x;
    const dy = (updated.y as number) - old.y;
    for (const el of elements) {
      if (el.type === "text" && (el as any).containerId === id) {
        const width = (el as any).width as number | undefined;
        const height = (el as any).height as number | undefined;
        if (width !== undefined && height !== undefined) {
          el.x = (updated.x as number) + ((updated.width as number) - width) / 2;
          el.y = (updated.y as number) + ((updated.height as number) - height) / 2;
          toRedraw.push({ text: el, container: updated });
        } else {
          el.x = (el.x as number) + dx;
          el.y = (el.y as number) + dy;
        }
      }
    }
  }

  if (toRedraw.length) {
    for (const { text, container } of toRedraw) {
      await tryRedrawBoundText(text, container, elements);
    }
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
