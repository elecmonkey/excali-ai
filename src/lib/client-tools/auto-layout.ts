import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, ExcalidrawElement, SceneToolResult } from "./types";
import type { CanvasOps } from "./scene-utils";
import { readScene, writeScene } from "./scene-utils";

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

  // build edge list for spring attraction
  const edges: [string, string][] = [];
  for (const el of elements) {
    if (el.type === "arrow" || el.type === "line") {
      const from = (el as any).startBinding?.elementId as string | undefined;
      const to = (el as any).endBinding?.elementId as string | undefined;
      if (!from || !to) continue;
      if (targetIds && (!targetIds.has(from) || !targetIds.has(to))) continue;
      edges.push([from, to]);
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
  const restLength = (n: NodeInfo, m: NodeInfo) => Math.max((n.w + m.w) / 2 + 40, k);

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
        const force = (k * k) / dist2;
        const dist = Math.sqrt(dist2);
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
      const desired = restLength(a, b);
      const force = (dist - desired) * 0.02;
      const fxVal = (force * dx) / dist;
      const fyVal = (force * dy) / dist;
      fx.set(a.id, (fx.get(a.id) || 0) - fxVal);
      fy.set(a.id, (fy.get(a.id) || 0) - fyVal);
      fx.set(b.id, (fx.get(b.id) || 0) + fxVal);
      fy.set(b.id, (fy.get(b.id) || 0) + fyVal);
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

    const intersectWithRect = (
      rect: ExcalidrawElement | undefined,
      target: [number, number]
    ): { point: [number, number]; focus: number } => {
      if (!rect) return { point: target, focus: 0.5 };
      const cx = (rect.x as number) + (rect.width as number) / 2;
      const cy = (rect.y as number) + (rect.height as number) / 2;
      const dx = target[0] - cx;
      const dy = target[1] - cy;
      const dirX = dx === 0 && dy === 0 ? 1 : dx;
      const dirY = dx === 0 && dy === 0 ? 0 : dy;
      const minX = rect.x as number;
      const maxX = (rect.x as number) + (rect.width as number);
      const minY = rect.y as number;
      const maxY = (rect.y as number) + (rect.height as number);
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
          ? ((px - minX) / (rect.width as number)) * 0.25
          : hit.edge === "right"
            ? 0.25 + ((py - minY) / (rect.height as number)) * 0.25
            : hit.edge === "bottom"
              ? 0.5 + ((maxX - px) / (rect.width as number)) * 0.25
              : 0.75 + ((maxY - py) / (rect.height as number)) * 0.25;

      return { point: hit.point, focus };
    };

    const startInfo = intersectWithRect(fromEl, toCenter);
    const endInfo = intersectWithRect(toEl, fromCenter);
    const dx = endInfo.point[0] - startInfo.point[0];
    const dy = endInfo.point[1] - startInfo.point[1];
    const points: [number, number][] = [
      [0, 0],
      [dx, dy],
    ];

    return {
      ...el,
      x: startInfo.point[0],
      y: startInfo.point[1],
      width: Math.abs(dx),
      height: Math.abs(dy),
      points,
      startBinding: { elementId: from, focus: startInfo.focus, gap: 4, fixedPoint: null },
      endBinding: { elementId: to, focus: endInfo.focus, gap: 4, fixedPoint: null },
    };
  });

  writeScene(canvasOps, finalElements, files);

  const output: SceneToolResult = {
    success: true,
    action: "auto-layout",
    message: `Auto layout applied to ${nodes.length} nodes`,
    elements: finalElements,
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
