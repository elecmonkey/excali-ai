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

  const intersectOnShape = (rect: ExcalidrawElement | undefined, target: [number, number]) => {
    if (!rect) return { point: target, focus: 0.5 };
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    let dx = target[0] - cx;
    const dy = target[1] - cy;
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
      const rx = rect.width / 2;
      const ry = rect.height / 2;
      const t = 1 / Math.sqrt((ldx * ldx) / (rx * rx) + (ldy * ldy) / (ry * ry));
      localPoint = [ldx * t, ldy * t];
    } else if (rect.type === "diamond") {
      const hx = rect.width / 2;
      const hy = rect.height / 2;
      const k = Math.abs(ldx) / hx + Math.abs(ldy) / hy || 1;
      localPoint = [ldx / k, ldy / k];
    } else {
      const minX = -rect.width / 2;
      const maxX = rect.width / 2;
      const minY = -rect.height / 2;
      const maxY = rect.height / 2;
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

  const fromCenter = fromEl ? [fromEl.x + fromEl.width / 2, fromEl.y + fromEl.height / 2] : [0, 0];
  const toCenter = toEl ? [toEl.x + toEl.width / 2, toEl.y + toEl.height / 2] : [100, 0];

  const startInfo = intersectOnShape(fromEl, toCenter as [number, number]);
  const endInfo = intersectOnShape(toEl, fromCenter as [number, number]);

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
    else if (parsed.data.type !== "line") (el as any).roundness = { type: 2 };
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

    // Force geometry to true shape intersections to avoid bounding-rect artifacts
    const startInfo2 = intersectOnShape(fromEl, toCenter as [number, number]);
    const endInfo2 = intersectOnShape(toEl, fromCenter as [number, number]);
    const dx2 = endInfo2.point[0] - startInfo2.point[0];
    const dy2 = endInfo2.point[1] - startInfo2.point[1];
    (el as any).x = startInfo2.point[0];
    (el as any).y = startInfo2.point[1];
    (el as any).width = Math.abs(dx2) || 1;
    (el as any).height = Math.abs(dy2) || 1;
    (el as any).points = [[0, 0], ...(parsed.data.via || []), [dx2, dy2]];
    (el as any).startBinding = {
      elementId: parsed.data.from,
      focus: startInfo2.focus,
      gap: ((el as any).startBinding?.gap as number | undefined) ?? 4,
      fixedPoint: null,
    };
    (el as any).endBinding = {
      elementId: parsed.data.to,
      focus: endInfo2.focus,
      gap: ((el as any).endBinding?.gap as number | undefined) ?? 4,
      fixedPoint: null,
    };
    if (parsed.data.type !== "line" && !(el as any).elbowed && !(el as any).roundness) {
      (el as any).roundness = { type: 2 };
    }
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
