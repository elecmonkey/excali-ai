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
  const fromCenter = fromEl ? [fromEl.x + fromEl.width / 2, fromEl.y + fromEl.height / 2] : [0, 0];
  const toCenter = toEl ? [toEl.x + toEl.width / 2, toEl.y + toEl.height / 2] : [100, 0];

  const intersectWithRect = (rect: ExcalidrawElement | undefined, target: [number, number]) => {
    if (!rect) return { point: target, focus: 0.5 };
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const dx = target[0] - cx;
    const dy = target[1] - cy;
    // Avoid zero-length direction
    const dirX = dx === 0 && dy === 0 ? 1 : dx;
    const dirY = dx === 0 && dy === 0 ? 0 : dy;

    const minX = rect.x;
    const maxX = rect.x + rect.width;
    const minY = rect.y;
    const maxY = rect.y + rect.height;

    const candidates: { t: number; point: [number, number]; edge: "top" | "right" | "bottom" | "left" }[] = [];

    if (dirX !== 0) {
      const tLeft = (minX - cx) / dirX;
      const yLeft = cy + tLeft * dirY;
      if (tLeft > 0 && yLeft >= minY && yLeft <= maxY) candidates.push({ t: tLeft, point: [minX, yLeft], edge: "left" });

      const tRight = (maxX - cx) / dirX;
      const yRight = cy + tRight * dirY;
      if (tRight > 0 && yRight >= minY && yRight <= maxY)
        candidates.push({ t: tRight, point: [maxX, yRight], edge: "right" });
    }

    if (dirY !== 0) {
      const tTop = (minY - cy) / dirY;
      const xTop = cx + tTop * dirX;
      if (tTop > 0 && xTop >= minX && xTop <= maxX) candidates.push({ t: tTop, point: [xTop, minY], edge: "top" });

      const tBottom = (maxY - cy) / dirY;
      const xBottom = cx + tBottom * dirX;
      if (tBottom > 0 && xBottom >= minX && xBottom <= maxX)
        candidates.push({ t: tBottom, point: [xBottom, maxY], edge: "bottom" });
    }

    const hit = candidates.sort((a, b) => a.t - b.t)[0];
    if (!hit) return { point: target, focus: 0.5 };

    const [px, py] = hit.point;
    const focus =
      hit.edge === "top"
        ? ((px - minX) / rect.width) * 0.25
        : hit.edge === "right"
          ? 0.25 + ((py - minY) / rect.height) * 0.25
          : hit.edge === "bottom"
            ? 0.5 + ((maxX - px) / rect.width) * 0.25
            : 0.75 + ((maxY - py) / rect.height) * 0.25;

    return { point: hit.point, focus };
  };

  const startInfo = intersectWithRect(fromEl, toCenter as [number, number]);
  const endInfo = intersectWithRect(toEl, fromCenter as [number, number]);

  const dx = endInfo.point[0] - startInfo.point[0];
  const dy = endInfo.point[1] - startInfo.point[1];
  const width = Math.abs(dx);
  const height = Math.abs(dy);

  const points: [number, number][] = [[0, 0], ...(parsed.data.via || []), [dx, dy]];

  const el: ExcalidrawElement = {
    ...createDefaultElement({
      id: edgeId,
      type: parsed.data.type === "line" ? "line" : "arrow",
      width,
      height,
      x: startInfo.point[0],
      y: startInfo.point[1],
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points: points as any,
  };
  // Make edges visually consistent with native defaults (thicker stroke)
  (el as any).strokeWidth = 2;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).startBinding = { elementId: parsed.data.from, focus: startInfo.focus, gap: 4, fixedPoint: null };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (el as any).endBinding = { elementId: parsed.data.to, focus: endInfo.focus, gap: 4, fixedPoint: null };

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

  const updatedElements = elements.map((candidate) => {
    if (candidate.id === parsed.data.from || candidate.id === parsed.data.to) {
      const bound = [...(candidate.boundElements ?? [])];
      if (!bound.some((b) => b.id === edgeId)) {
        bound.push({ type: "arrow", id: edgeId });
      }
      return { ...candidate, boundElements: bound };
    }
    return candidate;
  });

  const nextElements = [...updatedElements, el];
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
