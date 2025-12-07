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

  writeScene(canvasOps, nextElements, files);

  const output: SceneToolResult = {
    success: true,
    action: "auto-layout",
    message: `Auto layout applied to ${nodes.length} nodes`,
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
