import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import { readScene, writeScene, type CanvasOps, createDefaultElement } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { buildEdgeSkeleton, convertSkeletons } from "./skeleton-builders";

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
  const genId = () =>
    ((globalThis as any).crypto?.randomUUID?.() as string) ||
    `${baseId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let edgeId = genId();
  const genTextId = () =>
    ((globalThis as any).crypto?.randomUUID?.() as string) ||
    `edge-label-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  while (elements.some((el) => el.id === edgeId)) {
    edgeId = genId();
  }

  const fromEl = elements.find((el) => el.id === parsed.data.from);
  const toEl = elements.find((el) => el.id === parsed.data.to);

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

  const fromCenter = fromEl ? [fromEl.x + fromEl.width / 2, fromEl.y + fromEl.height / 2] : [0, 0];
  const toCenter = toEl ? [toEl.x + toEl.width / 2, toEl.y + toEl.height / 2] : [100, 0];

  const startInfo = intersectWithRect(fromEl, toCenter as [number, number]);
  const endInfo = intersectWithRect(toEl, fromCenter as [number, number]);

  const dx = endInfo.point[0] - startInfo.point[0];
  const dy = endInfo.point[1] - startInfo.point[1];
  const width = Math.max(Math.abs(dx), 1);
  const height = Math.max(Math.abs(dy), 1);
  const skeletonPoints: [number, number][] = [[0, 0], ...(parsed.data.via || []), [dx, dy]];

  const skeleton = buildEdgeSkeleton({
    id: edgeId,
    type: parsed.data.type ?? "arrow",
    from: parsed.data.from,
    to: parsed.data.to,
    via: parsed.data.via,
    x: startInfo.point[0],
    y: startInfo.point[1],
    width,
    height,
    points: skeletonPoints,
    label: parsed.data.label,
    startArrow: parsed.data.startArrow ?? parsed.data.startArrowhead,
    endArrow: parsed.data.endArrow ?? parsed.data.endArrowhead,
  });

  const converted = await convertSkeletons([skeleton], { regenerateIds: false });
  const pickConverted = (arr: ExcalidrawElement[] | null) => {
    if (!arr || !arr.length) return null;
    const candidate = arr.find((e) => e.id === edgeId) ?? arr[0];
    if (!candidate) return null;
    const pts = Array.isArray((candidate as any).points) ? ((candidate as any).points as any[]) : [];
    const validPoints = pts.length >= 2 && pts.every((p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const hasBindings =
      !!(candidate as any).startBinding?.elementId &&
      !!(candidate as any).endBinding?.elementId;
    if (!validPoints || !hasBindings) return null;
    return candidate;
  };

  let el: ExcalidrawElement | null = pickConverted(converted);

  if (!el) {
    // Fallback to manual construction
    el = {
      ...createDefaultElement({
        id: edgeId,
        type: parsed.data.type === "line" ? "line" : "arrow",
        width,
        height,
        x: startInfo.point[0],
        y: startInfo.point[1],
      }),
      points: skeletonPoints as any,
    };
    (el as any).startBinding = { elementId: parsed.data.from, focus: startInfo.focus, gap: 4, fixedPoint: null };
    (el as any).endBinding = { elementId: parsed.data.to, focus: endInfo.focus, gap: 4, fixedPoint: null };
    if (parsed.data.type === "elbow-arrow") (el as any).elbowed = true;
    if (parsed.data.type === "curved-arrow") (el as any).roundness = { type: 2 };
    if (parsed.data.startArrow ?? parsed.data.startArrowhead) (el as any).startArrowhead = "arrow";
    if (parsed.data.endArrow ?? parsed.data.endArrowhead) (el as any).endArrowhead = "arrow";
    if (parsed.data.label) (el as any).label = parsed.data.label;
  } else {
    // Ensure bindings exist even if conversion omitted them
    const ensureBinding = (
      binding: any,
      elementId: string | undefined,
      fallbackFocus: number,
      gap = 4
    ) => {
      if (!elementId) return binding;
      if (!binding) return { elementId, focus: fallbackFocus, gap, fixedPoint: null };
      return binding;
    };

    const fromCenter = fromEl ? [fromEl.x + fromEl.width / 2, fromEl.y + fromEl.height / 2] : [0, 0];
    const toCenter = toEl ? [toEl.x + toEl.width / 2, toEl.y + toEl.height / 2] : [0, 0];

    const focusByAxis = (axisDiff: number, primary: number, secondary: number) => {
      if (!primary && !secondary) return 0.5;
      if (Math.abs(primary) >= Math.abs(secondary)) {
        return axisDiff >= 0 ? 0.5 : 0;
      }
      return axisDiff >= 0 ? 0.25 : 0.75;
    };

    (el as any).startBinding = ensureBinding(
      (el as any).startBinding,
      parsed.data.from,
      focusByAxis(toCenter[1] - fromCenter[1], toCenter[0] - fromCenter[0], toCenter[1] - fromCenter[1])
    );
    (el as any).endBinding = ensureBinding(
      (el as any).endBinding,
      parsed.data.to,
      focusByAxis(fromCenter[1] - toCenter[1], fromCenter[0] - toCenter[0], fromCenter[1] - toCenter[1])
    );
  }

  // Make edges visually consistent with native defaults (thicker stroke)
  (el as any).strokeWidth = 2;

  const additions: ExcalidrawElement[] = [];

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

  // If label provided but no bound text exists, create one
  if (parsed.data.label) {
    const hasBoundText =
      Array.isArray((el as any).boundElements) &&
      (el as any).boundElements.some((b: any) => b.type === "text");
    if (!hasBoundText) {
      const lastPoint = Array.isArray((el as any).points) ? (el as any).points.slice(-1)[0] : [0, 0];
      const dxLabel = Array.isArray(lastPoint) && lastPoint.length === 2 ? lastPoint[0] : 0;
      const dyLabel = Array.isArray(lastPoint) && lastPoint.length === 2 ? lastPoint[1] : 0;
      const labelEl = createDefaultElement({
        id: genTextId(),
        type: "text",
        x: (el as any).x + dxLabel / 2,
        y: (el as any).y + dyLabel / 2,
        width: 100,
        height: 25,
        label: parsed.data.label,
      }) as any;
      labelEl.containerId = edgeId;
      labelEl.textAlign = "center";
      labelEl.verticalAlign = "middle";
      labelEl.originalText = parsed.data.label;
      labelEl.autoResize = true;
      labelEl.fontSize = 20;
      labelEl.fontFamily = 5;
      labelEl.strokeWidth = 2;
      labelEl.fillStyle = "solid";

      additions.push(labelEl as ExcalidrawElement);

      const bound = (el as any).boundElements ?? [];
      bound.push({ type: "text", id: labelEl.id });
      (el as any).boundElements = bound;
    }
  }

  const nextElements = [...updatedElements, el, ...additions];
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
