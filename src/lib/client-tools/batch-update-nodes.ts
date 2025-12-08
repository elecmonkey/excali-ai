import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { tryRedrawBoundText } from "./text-layout";
import { convertSkeletons } from "./skeleton-builders";

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

  const buildLabel = (el: any, upd: any) => {
    if (upd.label !== undefined) return upd.label;
    if (el.type === "text") return el.text as string | undefined;
    const boundText = elements.find(
      (item) => item.type === "text" && (item as any).containerId === el.id
    ) as any;
    if (boundText?.text) return boundText.text as string;
    if ((el as any).label?.text) return (el as any).label.text as string;
    return undefined;
  };

  const skeletons: any[] = [];
  const targetIds = new Set<string>();

  for (const upd of parsed.data.updates) {
    const el = elements.find((e) => e.id === upd.id) as any;
    if (!el) continue;
    targetIds.add(el.id);
    const label = buildLabel(el, upd);

    const skeleton: any = {
      id: el.id,
      type: upd.type ?? el.type,
      x: upd.x ?? el.x,
      y: upd.y ?? el.y,
      width: upd.width ?? el.width,
      height: upd.height ?? el.height,
      points: el.points,
      customData: (el as any).customData,
      strokeColor: (el as any).strokeColor,
      backgroundColor: (el as any).backgroundColor,
      strokeWidth: (el as any).strokeWidth ?? 2,
      strokeStyle: (el as any).strokeStyle,
      fillStyle: (el as any).fillStyle ?? "solid",
      roughness: (el as any).roughness,
      opacity: (el as any).opacity,
      roundness: (el as any).roundness ?? null,
      groupIds: (el as any).groupIds ?? [],
      frameId: (el as any).frameId ?? null,
      locked: (el as any).locked ?? false,
      fileId: (el as any).fileId,
      seed: (el as any).seed,
    };

    if (label) {
      if (skeleton.type === "text") {
        skeleton.text = label;
        skeleton.fontSize = (el as any).fontSize ?? 20;
        skeleton.fontFamily = (el as any).fontFamily ?? 5;
        skeleton.textAlign = (el as any).textAlign ?? "center";
        skeleton.verticalAlign = (el as any).verticalAlign ?? "middle";
      } else {
        skeleton.label = {
          text: label,
          fontSize: (el as any).fontSize ?? 20,
          fontFamily: (el as any).fontFamily ?? 5,
        };
      }
    }

    skeletons.push(skeleton);
  }

  const converted = skeletons.length ? await convertSkeletons(skeletons, { regenerateIds: false }) : null;

    if (converted && converted.length) {
    const isTargetOrBound = (item: any) =>
      targetIds.has(item.id) || (item.type === "text" && targetIds.has((item as any).containerId));
    const retained = elements.filter((el) => !isTargetOrBound(el));
    const nextElements = [...retained, ...converted];
    writeScene(canvasOps, nextElements, files as BinaryFiles);
  } else {
    // Fallback to legacy in-place update with bound-text move/redraw
    const originalPos = new Map<string, { x: number; y: number; w?: number; h?: number }>();

    for (const upd of parsed.data.updates) {
      const el = elements.find((e) => e.id === upd.id) as any;
      if (!el) continue;
      if ((upd.x !== undefined || upd.y !== undefined) && !originalPos.has(upd.id)) {
        originalPos.set(upd.id, { x: el.x as number, y: el.y as number, w: el.width, h: el.height });
      }
      if (upd.x !== undefined) el.x = upd.x;
      if (upd.y !== undefined) el.y = upd.y;
      if (upd.width !== undefined) el.width = upd.width;
      if (upd.height !== undefined) el.height = upd.height;
      if (upd.type) el.type = upd.type;
      if (upd.label && el.type === "text") el.text = upd.label;
      if (upd.label && el.type !== "text") (el as any).label = { text: upd.label };
    }

    const toRedraw: { text: any; container: any }[] = [];
    for (const [id, old] of originalPos.entries()) {
      const updated = elements.find((e) => e.id === id) as any;
      if (!updated) continue;
      const dx = (updated.x as number) - old.x;
      const dy = (updated.y as number) - old.y;
      for (const el of elements) {
        if (el.type === "text" && (el as any).containerId === id) {
          const labelUpdate = parsed.data.updates.find((u) => u.id === id)?.label;
          if (labelUpdate) {
            (el as any).text = labelUpdate;
            (el as any).originalText = labelUpdate;
          }
          const width = (el as any).width as number | undefined;
          const height = (el as any).height as number | undefined;
          const resized = updated.width !== old.w || updated.height !== old.h;
          if (width !== undefined && height !== undefined && (resized || labelUpdate)) {
            const w = (updated as any).width ?? old.w ?? width;
            const h = (updated as any).height ?? old.h ?? height;
            el.x = (updated.x as number) + (w - width) / 2;
            el.y = (updated.y as number) + (h - height) / 2;
            toRedraw.push({ text: el, container: updated });
          } else if (dx || dy) {
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
  }

  const output: SceneToolResult = {
    success: true,
    action: "batch-update-nodes",
    elements: readScene(canvasOps).elements,
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
