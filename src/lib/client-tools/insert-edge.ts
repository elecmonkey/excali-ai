import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import { readScene, writeScene, type CanvasOps, createDefaultElement } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "insertEdge";

const schema = z
  .object({
    // id intentionally not accepted; will auto-generate
    from: z.string(),
    to: z.string(),
    type: z.enum(["line", "arrow", "elbow-arrow", "curved-arrow"]).optional(),
    startArrow: z.boolean().optional(),
    endArrow: z.boolean().optional(),
    startArrowhead: z.boolean().optional(), // alias
    endArrowhead: z.boolean().optional(), // alias
    label: z.string().optional(),
    via: z.array(z.tuple([z.number(), z.number()])).optional(),
  })
  .strip();

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
  console.debug("[insertEdge] before insert", { count: elements.length });
  // auto-generate unique id
  const baseId = "edge";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const genId = () => ((globalThis as any).crypto?.randomUUID?.() as string) || `${baseId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let edgeId = genId();
  while (elements.some((el) => el.id === edgeId)) {
    edgeId = genId();
  }

  const fromEl = elements.find((el) => el.id === parsed.data.from);
  const toEl = elements.find((el) => el.id === parsed.data.to);
  const fromPos = fromEl ? [fromEl.x + fromEl.width / 2, fromEl.y + fromEl.height / 2] : [0, 0];
  const toPos = toEl ? [toEl.x + toEl.width / 2, toEl.y + toEl.height / 2] : [100, 0];

  const dx = toPos[0] - fromPos[0];
  const dy = toPos[1] - fromPos[1];
  const width = Math.abs(dx);
  const height = Math.abs(dy);

  const points: [number, number][] = [[0, 0], ...(parsed.data.via || []), [dx, dy]];

  const el: ExcalidrawElement = {
    ...createDefaultElement({
      id: edgeId,
      type: parsed.data.type === "line" ? "line" : "arrow",
      width,
      height,
      x: fromPos[0],
      y: fromPos[1],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points: points as any,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).startBinding = { elementId: parsed.data.from, focus: 0.5, gap: 0, fixedPoint: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).endBinding = { elementId: parsed.data.to, focus: 0.5, gap: 0, fixedPoint: null };

  const startArrow = parsed.data.startArrow ?? parsed.data.startArrowhead;
  const endArrow = parsed.data.endArrow ?? parsed.data.endArrowhead;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (startArrow !== undefined) (el as any).startArrowhead = startArrow ? "arrow" : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (endArrow !== undefined) (el as any).endArrowhead = endArrow ? "arrow" : null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (parsed.data.type === "elbow-arrow") (el as any).elbowed = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (parsed.data.label) (el as any).label = parsed.data.label;

  const nextElements = [...elements, el];
  writeScene(canvasOps, nextElements, files as BinaryFiles);
  console.debug("[insertEdge] after insert", { count: nextElements.length });

  const output: SceneToolResult = {
    success: true,
    action: "insert-edge",
    newId: edgeId,
    message: `Created ${edgeId}`,
    elements: nextElements,
    files,
  };

  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    state: "output-available",
    output,
  });
  console.debug("[insertEdge] output sent", { success: output.success, count: output.elements?.length });
}

export function matches(toolName: string) {
  return toolName === TOOL_NAME;
}
