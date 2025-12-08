import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import type { CanvasOps } from "./scene-utils";
import { readScene, writeScene, createDefaultElement } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "updateEdge";

const schema = z
  .object({
    id: z.string(),
    from: z.string().optional(),
    to: z.string().optional(),
    type: z.enum(["line", "arrow", "elbow-arrow", "curved-arrow"]).optional(),
    startArrow: z.boolean().optional(),
    endArrow: z.boolean().optional(),
    label: z.string().optional(),
    via: z.array(z.tuple([z.number(), z.number()])).optional(),
    points: z.array(z.tuple([z.number(), z.number()])).optional(),
    meta: z.record(z.string(), z.any()).optional(),
  })
  .strip();

const intersectOnShape = (rect: ExcalidrawElement | undefined, target: [number, number]) => {
  if (!rect) return { point: target, focus: 0.5 };
  const cx = rect.x + (rect as any).width / 2;
  const cy = rect.y + (rect as any).height / 2;
  let dx = target[0] - cx;
  let dy = target[1] - cy;
  if (dx === 0 && dy === 0) dx = 1;

  const angle = (rect as any).angle as number | undefined;
  const hasAngle = angle && angle !== 0;
  const sin = hasAngle ? Math.sin(-angle!) : 0;
  const cos = hasAngle ? Math.cos(-angle!) : 1;
  const rotToLocal = (px: number, py: number) => {
    if (!hasAngle) return [px, py] as [number, number];
    return [px * cos - py * sin, px * sin + py * cos] as [number, number];
  };
  const rotToWorld = (px: number, py: number) => {
    if (!hasAngle) return [px, py] as [number, number];
    return [px * cos + py * sin, -px * sin + py * cos] as [number, number];
  };

  const [ldx, ldy] = rotToLocal(dx, dy);

  let localPoint: [number, number];
  if (rect.type === "ellipse") {
    const rx = (rect as any).width / 2;
    const ry = (rect as any).height / 2;
    const t = 1 / Math.sqrt((ldx * ldx) / (rx * rx) + (ldy * ldy) / (ry * ry));
    localPoint = [ldx * t, ldy * t];
  } else if (rect.type === "diamond") {
    const hx = (rect as any).width / 2;
    const hy = (rect as any).height / 2;
    const k = Math.abs(ldx) / hx + Math.abs(ldy) / hy || 1;
    localPoint = [ldx / k, ldy / k];
  } else {
    const minX = -(rect as any).width / 2;
    const maxX = (rect as any).width / 2;
    const minY = -(rect as any).height / 2;
    const maxY = (rect as any).height / 2;
    const candidates: { t: number; p: [number, number]; edge: "top" | "right" | "bottom" | "left" }[] = [];
    if (ldx !== 0) {
      const tL = minX / ldx;
      const yL = tL * ldy;
      if (tL > 0 && yL >= minY && yL <= maxY) candidates.push({ t: tL, p: [minX, yL], edge: "left" });
      const tR = maxX / ldx;
      const yR = tR * ldy;
      if (tR > 0 && yR >= minY && yR <= maxY) candidates.push({ t: tR, p: [maxX, yR], edge: "right" });
    }
    if (ldy !== 0) {
      const tT = minY / ldy;
      const xT = tT * ldx;
      if (tT > 0 && xT >= minX && xT <= maxX) candidates.push({ t: tT, p: [xT, minY], edge: "top" });
      const tB = maxY / ldy;
      const xB = tB * ldx;
      if (tB > 0 && xB >= minX && xB <= maxX) candidates.push({ t: tB, p: [xB, maxY], edge: "bottom" });
    }
    const hit = candidates.sort((a, b) => a.t - b.t)[0];
    localPoint = hit ? hit.p : [0, 0];
  }

  const [wx, wy] = rotToWorld(localPoint[0], localPoint[1]);
  const px = cx + wx;
  const py = cy + wy;

  const edgeAngle = Math.atan2(py - cy, px - cx);
  const normAngle = (edgeAngle + 2 * Math.PI) % (2 * Math.PI);
  const focus =
    normAngle < Math.PI / 2
      ? 0.25 * (normAngle / (Math.PI / 2))
      : normAngle < Math.PI
        ? 0.25 + 0.25 * ((normAngle - Math.PI / 2) / (Math.PI / 2))
        : normAngle < (3 * Math.PI) / 2
          ? 0.5 + 0.25 * ((normAngle - Math.PI) / (Math.PI / 2))
          : 0.75 + 0.25 * ((normAngle - (3 * Math.PI) / 2) / (Math.PI / 2));

  return { point: [px, py], focus };
};

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
  const edge = elements.find((el) => el.id === parsed.data.id) as ExcalidrawElement | undefined;
  if (!edge || (edge.type !== "arrow" && edge.type !== "line")) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: `Edge ${parsed.data.id} not found`,
    });
    return;
  }

  const fromId = parsed.data.from ?? (edge as any).startBinding?.elementId;
  const toId = parsed.data.to ?? (edge as any).endBinding?.elementId;
  const fromEl = elements.find((el) => el.id === fromId) as ExcalidrawElement | undefined;
  const toEl = elements.find((el) => el.id === toId) as ExcalidrawElement | undefined;
  if (!fromEl || !toEl) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: `Edge endpoints not found (from:${fromId} to:${toId})`,
    });
    return;
  }

  const type = parsed.data.type ?? edge.type ?? "arrow";
  const fromCenter: [number, number] = [
    (fromEl.x as number) + (fromEl as any).width / 2,
    (fromEl.y as number) + (fromEl as any).height / 2,
  ];
  const toCenter: [number, number] = [
    (toEl.x as number) + (toEl as any).width / 2,
    (toEl.y as number) + (toEl as any).height / 2,
  ];

  const startInfo = intersectOnShape(fromEl, toCenter);
  const endInfo = intersectOnShape(toEl, fromCenter);
  const dx = endInfo.point[0] - startInfo.point[0];
  const dy = endInfo.point[1] - startInfo.point[1];
  const basePoints: [number, number][] = parsed.data.points
    ? (parsed.data.points as [number, number][])
    : [[0, 0], ...(parsed.data.via || []), [dx, dy]];

  const newEdge = {
    ...createDefaultElement({
      id: edge.id,
      type: type === "line" ? "line" : "arrow",
      x: startInfo.point[0],
      y: startInfo.point[1],
      width: Math.max(Math.abs(dx), 1),
      height: Math.max(Math.abs(dy), 1),
      label: parsed.data.label ?? (edge as any).label,
    }),
    points: basePoints as any,
  } as any;

  newEdge.startBinding = { elementId: fromId, focus: startInfo.focus, gap: 4, fixedPoint: null };
  newEdge.endBinding = { elementId: toId, focus: endInfo.focus, gap: 4, fixedPoint: null };
  if (type === "elbow-arrow") newEdge.elbowed = true;
  if (type === "curved-arrow") newEdge.roundness = { type: 2 };
  else if (type !== "line" && !newEdge.elbowed) newEdge.roundness = { type: 2 };
  if (parsed.data.startArrow !== undefined) newEdge.startArrowhead = parsed.data.startArrow ? "arrow" : null;
  else newEdge.startArrowhead = (edge as any).startArrowhead;
  if (parsed.data.endArrow !== undefined) newEdge.endArrowhead = parsed.data.endArrow ? "arrow" : null;
  else newEdge.endArrowhead = (edge as any).endArrowhead;
  if (parsed.data.meta) {
    newEdge.customData = { ...(edge as any).customData, ...parsed.data.meta };
  }
  newEdge.strokeWidth = (edge as any).strokeWidth ?? 2;
  newEdge.fillStyle = (edge as any).fillStyle ?? "solid";
  newEdge.strokeStyle = (edge as any).strokeStyle;
  newEdge.roughness = (edge as any).roughness;
  newEdge.opacity = (edge as any).opacity;

  const additions: ExcalidrawElement[] = [];
  if (parsed.data.label) {
    const hasBoundText =
      Array.isArray(newEdge.boundElements) &&
      newEdge.boundElements.some((b: any) => b.type === "text");
    if (!hasBoundText) {
      const lastPoint = Array.isArray(newEdge.points) ? (newEdge.points as any[]).slice(-1)[0] : [0, 0];
      const dxLabel = Array.isArray(lastPoint) && lastPoint.length === 2 ? lastPoint[0] : 0;
      const dyLabel = Array.isArray(lastPoint) && lastPoint.length === 2 ? lastPoint[1] : 0;
      const labelEl = createDefaultElement({
        id: ((globalThis as any).crypto?.randomUUID?.() as string) || `edge-label-${Date.now()}`,
        type: "text",
        x: newEdge.x + dxLabel / 2,
        y: newEdge.y + dyLabel / 2,
        width: 100,
        height: 25,
        label: parsed.data.label,
      }) as any;
      labelEl.containerId = newEdge.id;
      labelEl.textAlign = "center";
      labelEl.verticalAlign = "middle";
      labelEl.originalText = parsed.data.label;
      labelEl.autoResize = true;
      labelEl.fontSize = 20;
      labelEl.fontFamily = 5;
      labelEl.strokeWidth = 2;
      labelEl.fillStyle = "solid";

      additions.push(labelEl as ExcalidrawElement);

      const bound = newEdge.boundElements ?? [];
      bound.push({ type: "text", id: labelEl.id });
      newEdge.boundElements = bound;
    }
  }

  const updatedElements = elements.map((el) => {
    if (el.id === edge.id) return null as any;
    if (el.id === fromId || el.id === toId) {
      const bound = [...((el as any).boundElements ?? [])].filter((b: any) => b.id !== edge.id);
      bound.push({ type: "arrow", id: edge.id });
      return { ...el, boundElements: bound };
    }
    return el;
  }).filter(Boolean) as ExcalidrawElement[];

  const nextElements = [...updatedElements, newEdge as ExcalidrawElement, ...additions];

  writeScene(canvasOps, nextElements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "update-edge",
    elements: nextElements,
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
