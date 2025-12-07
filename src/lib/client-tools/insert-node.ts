import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { readScene, writeScene, type CanvasOps, createDefaultElement } from "./scene-utils";

export const TOOL_NAME = "insertNode";

const schema = z
  .object({
    // id intentionally not accepted; it will be auto-generated
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
  })
  .strip();

function generateId(base?: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uuid = (globalThis as any).crypto?.randomUUID?.();
  if (uuid) return uuid;
  const suffix = Math.random().toString(36).slice(2, 8);
  return base ? `${base}-${suffix}` : `node-${Date.now()}-${suffix}`;
}

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
      state: "output-error",
      errorText: parsed.error.message,
    });
    return;
  }

  const { elements, files } = readScene(canvasOps);
  let elementId = generateId("node");
  while (elements.some((el) => el.id === elementId)) {
    elementId = generateId("node");
  }
  console.debug("[insertNode] before insert", { count: elements.length, id: elementId });

  const el: ExcalidrawElement = createDefaultElement({
    id: elementId,
    type: parsed.data.type,
    x: parsed.data.x,
    y: parsed.data.y,
    width: parsed.data.width,
    height: parsed.data.height,
    label: parsed.data.label,
  });

  const relPos = placeRelative(elements, parsed.data.relativeTo, parsed.data.placement, el.width, el.height);
  if (relPos) {
    el.x = relPos.x;
    el.y = relPos.y;
  }

  if (parsed.data.fileId) (el as { fileId: string }).fileId = parsed.data.fileId;
  if (parsed.data.points) (el as { points: [number, number][] }).points = parsed.data.points;
  if (parsed.data.meta) (el as { customData: Record<string, unknown> }).customData = parsed.data.meta;

  const additions: ExcalidrawElement[] = [el];
  if (parsed.data.label && parsed.data.type !== "text") {
    // Dynamically import Excalidraw helpers to compute correct text bounds
    const [{ redrawTextBoundingBox }, { newElementWith }]: any = await Promise.all([
      import("@excalidraw/excalidraw"),
      import("@excalidraw/excalidraw"),
    ]);

    // Create a provisional text element bound to the container
    const textEl = createDefaultElement({
      id: generateId("text"),
      type: "text",
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      label: parsed.data.label,
    }) as any;
    textEl.containerId = elementId;
    textEl.textAlign = "center";
    textEl.verticalAlign = "middle";
    textEl.originalText = parsed.data.label;
    textEl.autoResize = true;

    // Use Excalidraw's redraw to center text within container
    redrawTextBoundingBox(textEl, el as any, { elements: [] } as any);

    additions.push(textEl);

    const bound = (el as any).boundElements ?? [];
    bound.push({ type: "text", id: textEl.id });
    (el as any).boundElements = bound;
  }

  const nextElements = [...elements, ...additions];
  writeScene(canvasOps, nextElements, files as BinaryFiles);
  console.debug("[insertNode] after insert", { count: nextElements.length });

  const output: SceneToolResult = {
    success: true,
    action: "insert-node",
    newId: elementId,
    message: `Created ${elementId}`,
    elements: nextElements,
    files,
  };

  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    state: "output-available",
    output,
  });
  console.debug("[insertNode] output sent", { success: output.success, count: output.elements?.length });
}

export function matches(toolName: string) {
  return toolName === TOOL_NAME;
}
