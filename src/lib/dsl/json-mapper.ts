import { parseDSL } from "./parser";
import { DSLDocument, EdgeBlock, EdgeKind, NodeBlock, NodeKind, Statement } from "./ast";

export interface ExcalidrawElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  version?: number;
  versionNonce?: number;
  index?: number;
  groupIds?: string[];
  frameId?: string;
  boundElements?: unknown[];
  link?: string | null;
  locked?: boolean;
  isDeleted?: boolean;
  updated?: number;
  seed?: number;
  customData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ExcalidrawScene {
  elements: ExcalidrawElement[];
  files: Record<string, unknown>;
  appState?: Record<string, unknown>;
}

function toNodeBlock(el: ExcalidrawElement): NodeBlock | null {
  // If this is a bound text (has containerId), treat it as label of container, not a standalone node
  if (el.type === "text" && (el as any).containerId) return null;
  if (el.type === "arrow" || el.type === "line") return null;

  const node: NodeBlock = {
    kind: "node",
    id: el.id,
    nodeKind: (el.type as NodeKind) || "rectangle",
    at: [el.x, el.y],
    size: [el.width, el.height],
    frame: el.frameId as string | undefined,
    groups: el.groupIds as string[] | undefined,
    link: (el.link as string | null) || undefined,
    locked: el.locked as boolean | undefined,
    meta: el.customData as Record<string, unknown> | undefined,
  };

  if (el.type === "text") {
    node.label = (el as { text?: string }).text;
  }

  if ("fileId" in el && typeof el.fileId === "string") {
    node.file = el.fileId;
  }

  if ("points" in el && Array.isArray(el.points)) {
    node.points = el.points as [number, number][];
  }

  return node;
}

function toEdgeBlock(el: ExcalidrawElement): EdgeBlock | null {
  if (el.type !== "arrow" && el.type !== "line") return null;
  const edgeKind: EdgeKind =
    el.type === "line"
      ? "line"
      : (el.elbowed ? "elbow-arrow" : "arrow");

  const sanitizePoint = (pt: any): [number, number] => {
    if (Array.isArray(pt) && pt.length === 2) {
      const [x, y] = pt;
      const sx = Number.isFinite(x) ? x : 0;
      const sy = Number.isFinite(y) ? y : 0;
      return [sx, sy];
    }
    return [0, 0];
  };

  const rawPoints = Array.isArray(el.points) ? (el.points as [number, number][]) : [];
  const points = rawPoints.map(sanitizePoint);
  const via = points.length > 2 ? points.slice(1, -1) : undefined;

  const startBinding = (el as any).startBinding;
  const endBinding = (el as any).endBinding;

  const edge: EdgeBlock = {
    kind: "edge",
    id: el.id,
    edgeKind,
    from: startBinding?.elementId ?? null,
    to: endBinding?.elementId ?? null,
    start: sanitizePoint(points[0]),
    end: sanitizePoint(points[points.length - 1]),
    via,
    startArrow: (el as any).startArrowhead ?? undefined,
    endArrow: (el as any).endArrowhead ?? undefined,
    mode: startBinding?.mode,
    frame: el.frameId as string | undefined,
    groups: el.groupIds as string[] | undefined,
    link: (el.link as string | null) || undefined,
    locked: el.locked as boolean | undefined,
    label: (el as { label?: string }).label,
    meta: el.customData as Record<string, unknown> | undefined,
  };
  return edge;
}

export function jsonToDsl(scene: ExcalidrawScene): DSLDocument {
  const nodeBlocks: NodeBlock[] = [];
  const edgeBlocks: EdgeBlock[] = [];
  const nodeMap = new Map<string, NodeBlock>();

  for (const el of scene.elements || []) {
    if (el.isDeleted) continue;
    const node = toNodeBlock(el);
    if (node) {
      nodeBlocks.push(node);
      nodeMap.set(node.id, node);
      continue;
    }
    const edge = toEdgeBlock(el);
    if (edge) {
      edgeBlocks.push(edge);
    }
  }

  // attach bound text as node labels
  for (const el of scene.elements || []) {
    if (el.isDeleted) continue;
    if (el.type === "text") {
      const containerId = (el as any).containerId as string | undefined;
      if (containerId && nodeMap.has(containerId)) {
        const node = nodeMap.get(containerId)!;
        if (!node.label) {
          node.label = (el as { text?: string }).text;
        }
      }
    }
  }

  // build adjacency lists per node
  const inMap = new Map<string, { edgeId: string; from?: string | null }[]>();
  const outMap = new Map<string, { edgeId: string; to?: string | null }[]>();
  for (const edge of edgeBlocks) {
    if (edge.to) {
      const arr = inMap.get(edge.to) ?? [];
      arr.push({ edgeId: edge.id, from: edge.from ?? null });
      inMap.set(edge.to, arr);
    }
    if (edge.from) {
      const arr = outMap.get(edge.from) ?? [];
      arr.push({ edgeId: edge.id, to: edge.to ?? null });
      outMap.set(edge.from, arr);
    }
  }
  for (const node of nodeBlocks) {
    node.inEdges = inMap.get(node.id) ?? [];
    node.outEdges = outMap.get(node.id) ?? [];
  }

  const statements: Statement[] = [...nodeBlocks, ...edgeBlocks];

  // files
  for (const [id, file] of Object.entries(scene.files || {})) {
    statements.push({
      kind: "file",
      id,
      mime: (file as { mimeType?: string }).mimeType,
      data: (file as { dataURL?: string }).dataURL,
      version: (file as { version?: number }).version,
    });
  }

  if (scene.appState) {
    statements.push({
      kind: "appState",
      viewBackgroundColor: scene.appState.viewBackgroundColor as string | undefined,
      gridSize: scene.appState.gridSize as number | undefined,
      gridStep: scene.appState.gridStep as number | undefined,
      gridModeEnabled: scene.appState.gridModeEnabled as boolean | undefined,
      lockedMultiSelections: scene.appState.lockedMultiSelections as Record<string, boolean> | undefined,
      meta: scene.appState.meta as Record<string, unknown> | undefined,
    });
  }

  return { statements };
}

function applyNodeBlock(block: NodeBlock, elements: ExcalidrawElement[]) {
  const existing = elements.find((el) => el.id === (block.ref || block.id));
  const base: ExcalidrawElement = existing || {
    id: block.ref || block.id,
    type: block.nodeKind,
    x: 0,
    y: 0,
    width: 120,
    height: 60,
  };

  if (block.at) {
    base.x = block.at[0];
    base.y = block.at[1];
  }
  if (block.size) {
    base.width = block.size[0];
    base.height = block.size[1];
  }
  if (block.label && base.type === "text") {
    (base as any).text = block.label;
  }
  if (block.file) {
    (base as { fileId?: string }).fileId = block.file;
  }
  if (block.frame) base.frameId = block.frame;
  if (block.groups) base.groupIds = block.groups;
  if (block.link) base.link = block.link;
  if (block.locked !== undefined) base.locked = block.locked;
  if (block.meta) base.customData = block.meta;
  if (block.points) (base as { points?: [number, number][] }).points = block.points;

  if (!existing) {
    elements.push(base);
  }
}

function applyEdgeBlock(block: EdgeBlock, elements: ExcalidrawElement[]) {
  const existing = elements.find((el) => el.id === (block.ref || block.id));
  const base: ExcalidrawElement = existing || {
    id: block.ref || block.id,
    type: block.edgeKind === "line" ? "line" : "arrow",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    points: [],
  };

  base.type = block.edgeKind === "line" ? "line" : "arrow";
  const points: [number, number][] = [];
  if (block.start) points.push(block.start);
  if (block.via) points.push(...block.via);
  if (block.end) points.push(block.end);
  (base as any).points = points;

  if (block.from) {
    (base as { startBinding?: { elementId: string; mode?: string } }).startBinding = {
      elementId: block.from,
      mode: block.mode,
    };
  }
  if (block.to) {
    (base as { endBinding?: { elementId: string; mode?: string } }).endBinding = {
      elementId: block.to,
      mode: block.mode,
    };
  }
  if (block.startArrow !== undefined) (base as { startArrowhead?: string | null }).startArrowhead = block.startArrow;
  if (block.endArrow !== undefined) (base as { endArrowhead?: string | null }).endArrowhead = block.endArrow;
  if (block.frame) base.frameId = block.frame;
  if (block.groups) base.groupIds = block.groups;
  if (block.link) base.link = block.link;
  if (block.locked !== undefined) base.locked = block.locked;
  if (block.label) (base as { label?: string }).label = block.label;
  if (block.meta) base.customData = block.meta;

  if (!existing) {
    elements.push(base);
  }
}

function applyUpdate(block: Statement, elements: ExcalidrawElement[]) {
  if (block.kind !== "update") return;
  const target = elements.find((el) => el.id === block.id);
  if (!target) return;
  Object.assign(target, block.values);
}

function applyDelete(block: Statement, elements: ExcalidrawElement[]) {
  if (block.kind !== "delete") return;
  const idx = elements.findIndex((el) => el.id === block.id);
  if (idx !== -1) {
    elements.splice(idx, 1);
  }
}

export function applyDslPatch(dslText: string, scene: ExcalidrawScene): ExcalidrawScene {
  const doc = parseDSL(dslText);
  const next: ExcalidrawScene = {
    elements: [...(scene.elements || [])],
    files: { ...(scene.files || {}) },
    appState: { ...(scene.appState || {}) },
  };

  for (const stmt of doc.statements) {
    switch (stmt.kind) {
      case "node":
        applyNodeBlock(stmt, next.elements);
        break;
      case "edge":
        applyEdgeBlock(stmt, next.elements);
        break;
      case "update":
        applyUpdate(stmt, next.elements);
        break;
      case "delete":
        applyDelete(stmt, next.elements);
        break;
      case "file":
        next.files[stmt.id] = {
          id: stmt.id,
          mimeType: stmt.mime,
          dataURL: stmt.data,
          version: stmt.version,
        };
        break;
      case "appState":
        next.appState = {
          ...(next.appState || {}),
          viewBackgroundColor: stmt.viewBackgroundColor ?? next.appState?.viewBackgroundColor,
          gridSize: stmt.gridSize ?? next.appState?.gridSize,
          gridStep: stmt.gridStep ?? next.appState?.gridStep,
          gridModeEnabled: stmt.gridModeEnabled ?? next.appState?.gridModeEnabled,
          lockedMultiSelections: stmt.lockedMultiSelections ?? next.appState?.lockedMultiSelections,
          meta: stmt.meta ?? next.appState?.meta,
        };
        break;
      default:
        break;
    }
  }

  return next;
}
