import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, ExcalidrawElement, SceneToolResult } from "./types";
import type { CanvasOps } from "./scene-utils";
import { readScene, writeScene } from "./scene-utils";
import { tryRedrawBoundText } from "./text-layout";
import { detectOverlaps } from "../geometry/overlap";

export const TOOL_NAME = "autoLayout";

const schema = z
  .object({
    nodes: z.array(z.string()).optional(),
    iterations: z.number().min(1).max(300).optional(),
  })
  .strip();

type NodeInfo = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
};

const estimateLabelWidth = (text: string | undefined, measured?: number) => {
  if (measured && Number.isFinite(measured)) return measured;
  if (!text) return 0;
  let width = 0;
  for (const ch of text) {
    // crude: CJK + fullwidth punctuation treated as wide
    width += /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch) ? 40 : 12;
  }
  return width;
};

function hasLabel(el: ExcalidrawElement, elements: ExcalidrawElement[]) {
  for (const e of elements) {
    if (e.type === "text" && (e as any).containerId === el.id) {
      const text = (e as any).text as string | undefined;
      if (text && text.trim()) return true;
    }
  }
  const label = (el as any).label as string | undefined;
  return !!(label && label.trim());
}

export async function execute(toolCall: ToolCallInfo, addToolOutput: AddToolOutputFn, canvasOps?: CanvasOps) {
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
  const targetIds = parsed.data.nodes ? new Set(parsed.data.nodes) : null;

  const nodes: NodeInfo[] = [];
  for (const el of elements) {
    if (!["rectangle", "diamond", "ellipse"].includes(el.type as string)) continue;
    if (!hasLabel(el, elements)) continue;
    if (targetIds && !targetIds.has(el.id)) continue;
    nodes.push({
      id: el.id,
      x: el.x as number,
      y: el.y as number,
      w: el.width as number,
      h: el.height as number,
      vx: 0,
      vy: 0,
    });
  }

  // build edge list for spring attraction and edge repulsion helpers
  const edges: [string, string][] = [];
  const edgePairs: [NodeInfo, NodeInfo][] = [];
  const edgeLabelWidth = new Map<string, number>();
  for (const el of elements) {
    if (el.type === "arrow" || el.type === "line") {
      const from = (el as any).startBinding?.elementId as string | undefined;
      const to = (el as any).endBinding?.elementId as string | undefined;
      if (!from || !to) continue;
      if (targetIds && (!targetIds.has(from) || !targetIds.has(to))) continue;
      edges.push([from, to]);
      const a = nodes.find((n) => n.id === from);
      const b = nodes.find((n) => n.id === to);
      if (a && b) edgePairs.push([a, b]);

      // capture label width from bound text or label property
      let lblWidth = 0;
      const boundText = elements.find(
        (t) => t.type === "text" && (t as any).containerId === el.id
      ) as any;
      if (boundText) {
        lblWidth = estimateLabelWidth(boundText.text as string | undefined, boundText.width as number | undefined);
      } else if ((el as any).label) {
        lblWidth = estimateLabelWidth((el as any).label as string);
      }
      edgeLabelWidth.set(el.id, lblWidth);
    }
  }

  if (nodes.length === 0) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-available",
      output: { success: true, action: "auto-layout", message: "No eligible nodes to layout", elements, files },
    });
    return;
  }

  const iter = parsed.data.iterations ?? 120;
  const area = 200 * 200;
  const k = Math.sqrt(area / nodes.length);
  const centerX = nodes.reduce((s, n) => s + n.x, 0) / nodes.length;
  const centerY = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const minSide = (n: NodeInfo) => Math.min(n.w, n.h);
  const restLength = (a: NodeInfo, b: NodeInfo, labelWidth: number) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const dirX = dx / dist;
    const dirY = dy / dist;
    const proj = (n: NodeInfo) => Math.abs(dirX) * (n.w / 2) + Math.abs(dirY) * (n.h / 2);
    const marginA = proj(a);
    const marginB = proj(b);

    const base = Math.max((a.w + b.w) / 2 + 40, k, Math.max(minSide(a), minSide(b)));
    const labelNeed = labelWidth ? labelWidth + 20 : 0;
    const requiredAlongLine = marginA + marginB + Math.max(base, labelNeed, 80);
    return requiredAlongLine;
  };

  for (let step = 0; step < iter; step++) {
    // reset forces
    const fx = new Map<string, number>();
    const fy = new Map<string, number>();
    for (const n of nodes) {
      fx.set(n.id, 0);
      fy.set(n.id, 0);
    }

    // repulsion
    for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist2 = dx * dx + dy * dy || 0.01;
      const dist = Math.sqrt(dist2);
      const minSep = Math.max(minSide(a), minSide(b));
      const baseForce = (k * k) / dist2;
      // Stronger push when closer than minSep
      const force = dist < minSep ? baseForce * (minSep / dist) : baseForce;
      const fxVal = (force * dx) / dist;
      const fyVal = (force * dy) / dist;
      fx.set(a.id, (fx.get(a.id) || 0) + fxVal);
      fy.set(a.id, (fy.get(a.id) || 0) + fyVal);
      fx.set(b.id, (fx.get(b.id) || 0) - fxVal);
      fy.set(b.id, (fy.get(b.id) || 0) - fyVal);
    }
    }

    // attraction along edges
    for (const [from, to] of edges) {
      const a = nodeMap.get(from);
      const b = nodeMap.get(to);
      if (!a || !b) continue;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const lblW =
        edgeLabelWidth.get(
          elements.find(
            (e) =>
              (e.type === "arrow" || e.type === "line") &&
              (e as any).startBinding?.elementId === from &&
              (e as any).endBinding?.elementId === to
          )?.id || ""
        ) || 0;
      const desired = restLength(a, b, lblW);
      const force = (dist - desired) * 0.02;
      const fxVal = (force * dx) / dist;
      const fyVal = (force * dy) / dist;
      fx.set(a.id, (fx.get(a.id) || 0) - fxVal);
      fy.set(a.id, (fy.get(a.id) || 0) - fyVal);
      fx.set(b.id, (fx.get(b.id) || 0) + fxVal);
      fy.set(b.id, (fy.get(b.id) || 0) + fyVal);
    }

    // edge-edge repulsion (push disconnected edges apart)
    for (let i = 0; i < edgePairs.length; i++) {
      for (let j = i + 1; j < edgePairs.length; j++) {
        const [a1, a2] = edgePairs[i];
        const [b1, b2] = edgePairs[j];
        // skip if sharing a node
        if (a1.id === b1.id || a1.id === b2.id || a2.id === b1.id || a2.id === b2.id) continue;

        const midAx = (a1.x + a2.x) / 2;
        const midAy = (a1.y + a2.y) / 2;
        const midBx = (b1.x + b2.x) / 2;
        const midBy = (b1.y + b2.y) / 2;
        const dx = midAx - midBx;
        const dy = midAy - midBy;
        const dist2 = dx * dx + dy * dy || 0.01;
        const force = (k * k * 0.2) / dist2;
        const dist = Math.sqrt(dist2);
        const fxVal = (force * dx) / dist;
        const fyVal = (force * dy) / dist;

        for (const n of [a1, a2]) {
          fx.set(n.id, (fx.get(n.id) || 0) + fxVal);
          fy.set(n.id, (fy.get(n.id) || 0) + fyVal);
        }
        for (const n of [b1, b2]) {
          fx.set(n.id, (fx.get(n.id) || 0) - fxVal);
          fy.set(n.id, (fy.get(n.id) || 0) - fyVal);
        }
      }
    }

    // integrate
    for (const n of nodes) {
      n.vx = (n.vx + (fx.get(n.id) || 0) * 0.1) * 0.85;
      n.vy = (n.vy + (fy.get(n.id) || 0) * 0.1) * 0.85;
      n.x += n.vx;
      n.y += n.vy;

      // mild gravity to center
      n.x += (centerX - n.x) * 0.001;
      n.y += (centerY - n.y) * 0.001;
    }
  }

  // apply back to elements (only moved nodes)
  const updates = new Map(nodes.map((n) => [n.id, n]));
  const originalPos = new Map<string, { x: number; y: number }>();
  for (const el of elements) {
    if (updates.has(el.id)) {
      originalPos.set(el.id, { x: el.x as number, y: el.y as number });
    }
  }

  const nextElements = elements.map((el) => {
    const move = updates.get(el.id);
    if (move) {
      return { ...el, x: move.x, y: move.y };
    }
    if (el.type === "text") {
      const containerId = (el as any).containerId as string | undefined;
      if (containerId && updates.has(containerId) && originalPos.has(containerId)) {
        const newPos = updates.get(containerId)!;
        const oldPos = originalPos.get(containerId)!;
        const dx = newPos.x - oldPos.x;
        const dy = newPos.y - oldPos.y;
        return { ...el, x: (el.x as number) + dx, y: (el.y as number) + dy };
      }
    }
    return el;
  });

  // Rebuild edges with updated bindings/points
  const nodeLookup = new Map<string, ExcalidrawElement>();
  for (const el of nextElements) {
    if (["rectangle", "diamond", "ellipse"].includes(el.type as string)) {
      nodeLookup.set(el.id, el);
    }
  }

  const finalElements = nextElements.map((el) => {
    if (el.type !== "arrow" && el.type !== "line") return el;
    const from = (el as any).startBinding?.elementId as string | undefined;
    const to = (el as any).endBinding?.elementId as string | undefined;
    if (!from || !to) return el;
    const fromEl = nodeLookup.get(from);
    const toEl = nodeLookup.get(to);
    if (!fromEl || !toEl) return el;

    const fromCenter: [number, number] = [
      (fromEl.x as number) + (fromEl.width as number) / 2,
      (fromEl.y as number) + (fromEl.height as number) / 2,
    ];
    const toCenter: [number, number] = [
      (toEl.x as number) + (toEl.width as number) / 2,
      (toEl.y as number) + (toEl.height as number) / 2,
    ];

    const intersectOnShape = (
      rect: ExcalidrawElement | undefined,
      target: [number, number]
    ): { point: [number, number]; focus: number } => {
      if (!rect) return { point: target, focus: 0.5 };
      const cx = (rect.x as number) + (rect.width as number) / 2;
      const cy = (rect.y as number) + (rect.height as number) / 2;
      let dx = target[0] - cx;
      let dy = target[1] - cy;
      if (dx === 0 && dy === 0) dx = 1; // avoid zero vector

      const angle = (rect as any).angle as number | undefined;
      const hasAngle = angle && angle !== 0;
      const sin = hasAngle ? Math.sin(-angle!) : 0;
      const cos = hasAngle ? Math.cos(-angle!) : 1;
      const rotateToLocal = (px: number, py: number) => {
        if (!hasAngle) return [px, py] as [number, number];
        const rx = px * cos - py * sin;
        const ry = px * sin + py * cos;
        return [rx, ry] as [number, number];
      };
      const rotateToWorld = (px: number, py: number) => {
        if (!hasAngle) return [px, py] as [number, number];
        const rx = px * cos + py * sin;
        const ry = -px * sin + py * cos;
        return [rx, ry] as [number, number];
      };

      const [ldx, ldy] = rotateToLocal(dx, dy);

      let localPoint: [number, number];
      if (rect.type === "ellipse") {
        const rx = (rect.width as number) / 2;
        const ry = (rect.height as number) / 2;
        const t = 1 / Math.sqrt((ldx * ldx) / (rx * rx) + (ldy * ldy) / (ry * ry));
        localPoint = [ldx * t, ldy * t];
      } else if (rect.type === "diamond") {
        const hx = (rect.width as number) / 2;
        const hy = (rect.height as number) / 2;
        const k = Math.abs(ldx) / hx + Math.abs(ldy) / hy || 1;
        localPoint = [ldx / k, ldy / k];
      } else {
        // rectangle fallback: clamp to edges along direction
        const minX = -(rect.width as number) / 2;
        const maxX = (rect.width as number) / 2;
        const minY = -(rect.height as number) / 2;
        const maxY = (rect.height as number) / 2;
        const candidates: { t: number; p: [number, number]; edge: "top" | "right" | "bottom" | "left" }[] = [];
        if (ldx !== 0) {
          const tL = (minX) / ldx;
          const yL = tL * ldy;
          if (tL > 0 && yL >= minY && yL <= maxY) candidates.push({ t: tL, p: [minX, yL], edge: "left" });
          const tR = (maxX) / ldx;
          const yR = tR * ldy;
          if (tR > 0 && yR >= minY && yR <= maxY) candidates.push({ t: tR, p: [maxX, yR], edge: "right" });
        }
        if (ldy !== 0) {
          const tT = (minY) / ldy;
          const xT = tT * ldx;
          if (tT > 0 && xT >= minX && xT <= maxX) candidates.push({ t: tT, p: [xT, minY], edge: "top" });
          const tB = (maxY) / ldy;
          const xB = tB * ldx;
          if (tB > 0 && xB >= minX && xB <= maxX) candidates.push({ t: tB, p: [xB, maxY], edge: "bottom" });
        }
        const hit = candidates.sort((a, b) => a.t - b.t)[0];
        localPoint = hit ? hit.p : [0, 0];
      }

      const [wx, wy] = rotateToWorld(localPoint[0], localPoint[1]);
      const px = cx + wx;
      const py = cy + wy;

      // Approximate focus by quadrant mapping (0-top, 0.25-right, 0.5-bottom, 0.75-left)
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

    const startInfo = intersectOnShape(fromEl, toCenter);
    const endInfo = intersectOnShape(toEl, fromCenter);
    const dx = endInfo.point[0] - startInfo.point[0];
    const dy = endInfo.point[1] - startInfo.point[1];
    const points: [number, number][] = [
      [0, 0],
      [dx, dy],
    ];

    const rebuilt: any = {
      ...el,
      x: startInfo.point[0],
      y: startInfo.point[1],
      width: Math.abs(dx),
      height: Math.abs(dy),
      points,
      startBinding: { elementId: from, focus: startInfo.focus, gap: 4, fixedPoint: null },
      endBinding: { elementId: to, focus: endInfo.focus, gap: 4, fixedPoint: null },
    };
    if (el.type === "arrow" && !(rebuilt as any).elbowed && !(rebuilt as any).roundness) {
      rebuilt.roundness = { type: 2 };
    }
    return rebuilt;
  });

  // recentre bound texts and redraw bounding boxes
  const centered = [...finalElements];
  for (let i = 0; i < centered.length; i++) {
    const el = centered[i];
    if (el.type !== "text") continue;
    const containerId = (el as any).containerId as string | undefined;
    if (!containerId) continue;
    const container = nodeLookup.get(containerId);
    if (!container) continue;
    const width = (el as any).width as number | undefined;
    const height = (el as any).height as number | undefined;
    if (width === undefined || height === undefined) continue;
    el.x = (container.x as number) + ((container.width as number) - width) / 2;
    el.y = (container.y as number) + ((container.height as number) - height) / 2;
    await tryRedrawBoundText(el, container, centered);
  }

  // Post-process: resolve overlaps by pushing nodes apart
  const resolveOverlaps = () => {
    let overlaps = detectOverlaps(centered, 1);
    if (!overlaps.length) return;
    const nodeLookup2 = new Map<string, ExcalidrawElement>();
    for (const el of centered) {
      if (["rectangle", "diamond", "ellipse"].includes(el.type as string)) {
        nodeLookup2.set(el.id, el);
      }
    }
    let guard = 0;
    while (overlaps.length && guard < 10) {
      for (const ov of overlaps) {
        const a = nodeLookup2.get(ov.a);
        const b = nodeLookup2.get(ov.b);
        if (!a || !b) continue;
        const ax = (a.x as number) + (a.width as number) / 2;
        const ay = (a.y as number) + (a.height as number) / 2;
        const bx = (b.x as number) + (b.width as number) / 2;
        const by = (b.y as number) + (b.height as number) / 2;
        let dx = ax - bx;
        let dy = ay - by;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        dx /= dist;
        dy /= dist;
        // push each by half the needed gap plus padding
        const pad = 10;
        const push = Math.sqrt(ov.overlapArea) / 2 + pad;
        a.x = (a.x as number) + dx * push;
        a.y = (a.y as number) + dy * push;
        b.x = (b.x as number) - dx * push;
        b.y = (b.y as number) - dy * push;
      }
      overlaps = detectOverlaps(centered, 1);
      guard++;
    }
  };

  resolveOverlaps();

  writeScene(canvasOps, centered, files);

  const output: SceneToolResult = {
    success: true,
    action: "auto-layout",
    message: `Auto layout applied to ${nodes.length} nodes`,
    elements: centered,
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
