import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { tryRedrawBoundText } from "./text-layout";
import { convertSkeletons } from "./skeleton-builders";

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

  const buildLabel = () => {
    if (parsed.data.label !== undefined) return parsed.data.label;
    // fallback to existing label/text
    if (target.type === "text") return (target as any).text as string | undefined;
    const boundText = elements.find(
      (el) => el.type === "text" && (el as any).containerId === target.id
    ) as any;
    if (boundText?.text) return boundText.text as string;
    if ((target as any).label?.text) return (target as any).label.text as string;
    return undefined;
  };

  const mergedMeta = parsed.data.meta
    ? {
        ...(target as any).customData,
        ...parsed.data.meta,
      }
    : (target as any).customData;

  const skeleton: any = {
    id: target.id,
    type: parsed.data.type ?? target.type,
    x: parsed.data.x ?? target.x,
    y: parsed.data.y ?? target.y,
    width: parsed.data.width ?? (target as any).width,
    height: parsed.data.height ?? (target as any).height,
    points: parsed.data.points ?? (target as any).points,
    label: undefined,
    text: undefined,
    customData: mergedMeta,
    strokeColor: (target as any).strokeColor,
    backgroundColor: (target as any).backgroundColor,
    strokeWidth: (target as any).strokeWidth ?? 2,
    strokeStyle: (target as any).strokeStyle,
    fillStyle: (target as any).fillStyle ?? "solid",
    roughness: (target as any).roughness,
    opacity: (target as any).opacity,
    roundness: (target as any).roundness ?? null,
    groupIds: (target as any).groupIds ?? [],
    frameId: (target as any).frameId ?? null,
    locked: (target as any).locked ?? false,
    fileId: (target as any).fileId,
    seed: (target as any).seed,
  };

  const label = buildLabel();
  if (label) {
    if (skeleton.type === "text") {
      skeleton.text = label;
      skeleton.fontSize = (target as any).fontSize ?? 20;
      skeleton.fontFamily = (target as any).fontFamily ?? 5;
      skeleton.textAlign = (target as any).textAlign ?? "center";
      skeleton.verticalAlign = (target as any).verticalAlign ?? "middle";
    } else {
      skeleton.label = {
        text: label,
        fontSize: (target as any).fontSize ?? 20,
        fontFamily: (target as any).fontFamily ?? 5,
      };
    }
  }

  const converted = await convertSkeletons([skeleton], { regenerateIds: false });

  if (converted && converted.length) {
    const convertedIds = new Set(converted.map((el) => el.id));
    const isBoundToTarget = (el: ExcalidrawElement) =>
      el.type === "text" && (el as any).containerId === target.id;
    const retained = elements.filter((el) => el.id !== target.id && !isBoundToTarget(el));
    const nextElements = [...retained, ...converted];
    writeScene(canvasOps, nextElements, files as BinaryFiles);
  } else {
    // Fallback to legacy in-place update with bound-text move/redraw
    const oldX = target.x as number;
    const oldY = target.y as number;
    const oldW = (target as any).width as number | undefined;
    const oldH = (target as any).height as number | undefined;

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
    if (parsed.data.label && target.type !== "text") {
      (target as any).label = { text: parsed.data.label };
    }

    const moved = parsed.data.x !== undefined || parsed.data.y !== undefined;
    const resized = parsed.data.width !== undefined || parsed.data.height !== undefined;
    const dx = (target.x as number) - oldX;
    const dy = (target.y as number) - oldY;

    const toRedraw: { text: any; container: any }[] = [];
    for (const el of elements) {
      if (el.type === "text" && (el as any).containerId === target.id) {
        if (parsed.data.label) {
          (el as any).text = parsed.data.label;
          (el as any).originalText = parsed.data.label;
        }
        const width = (el as any).width as number | undefined;
        const height = (el as any).height as number | undefined;
        if (width !== undefined && height !== undefined && (moved || resized || parsed.data.label)) {
          const w = (target as any).width ?? oldW ?? width;
          const h = (target as any).height ?? oldH ?? height;
          el.x = (target.x as number) + (w - width) / 2;
          el.y = (target.y as number) + (h - height) / 2;
          toRedraw.push({ text: el, container: target });
        } else if (moved) {
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

    writeScene(canvasOps, elements, files as BinaryFiles);
  }

  const output: SceneToolResult = {
    success: true,
    action: "update-node",
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
