import type { ExcalidrawElement } from "./types";

export type NodeSkeletonInput = {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
  meta?: Record<string, unknown>;
  fileId?: string;
  points?: [number, number][];
};

export type EdgeSkeletonInput = {
  id: string;
  type: "arrow" | "line" | "elbow-arrow" | "curved-arrow";
  from: string;
  to: string;
  via?: [number, number][];
  label?: string;
  startArrow?: boolean;
  endArrow?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: [number, number][];
};

export function buildNodeSkeleton(input: NodeSkeletonInput) {
  const skeleton: any = {
    id: input.id,
    type: input.type,
    x: input.x ?? 0,
    y: input.y ?? 0,
    width: input.width,
    height: input.height,
    strokeWidth: 2,
    fillStyle: "solid",
    roundness: null,
  };

  if (input.label) {
    if (input.type === "text") {
      skeleton.text = input.label;
      skeleton.fontSize = 20;
      skeleton.fontFamily = 5;
      skeleton.textAlign = "center";
      skeleton.verticalAlign = "middle";
    } else {
      skeleton.label = {
        text: input.label,
        fontSize: 20,
        fontFamily: 5,
      };
    }
  }

  if (input.meta) {
    skeleton.customData = input.meta;
  }
  if (input.fileId) {
    skeleton.fileId = input.fileId;
  }
  if (input.points) {
    skeleton.points = input.points;
  }

  return skeleton;
}

export function buildEdgeSkeleton(input: EdgeSkeletonInput) {
  const skeleton: any = {
    id: input.id,
    type: input.type === "line" ? "line" : "arrow",
    strokeWidth: 2,
    start: { id: input.from },
    end: { id: input.to },
  };
  if (input.x !== undefined) skeleton.x = input.x;
  if (input.y !== undefined) skeleton.y = input.y;
  if (input.width !== undefined) skeleton.width = input.width;
  if (input.height !== undefined) skeleton.height = input.height;
  if (input.via && input.via.length) {
    skeleton.points = input.via;
  }
  if (input.points && input.points.length) {
    skeleton.points = input.points;
  }
  if (input.label) {
    skeleton.label = { text: input.label };
  }
  if (input.startArrow !== undefined) skeleton.startArrowhead = input.startArrow ? "arrow" : null;
  if (input.endArrow !== undefined) skeleton.endArrowhead = input.endArrow ? "arrow" : null;
  if (input.type === "elbow-arrow") skeleton.elbowed = true;
  if (input.type === "curved-arrow") skeleton.roundness = { type: 2 };
  return skeleton;
}

export async function convertSkeletons(
  skeletons: any[],
  opts: { regenerateIds?: boolean } = { regenerateIds: false }
): Promise<ExcalidrawElement[] | null> {
  try {
    // Avoid calling converter when bindings point to non-existent skeletons (it will throw noisy errors)
    const idSet = new Set<string>();
    for (const s of skeletons) {
      if (s && typeof s.id === "string") idSet.add(s.id);
    }
    for (const s of skeletons) {
      if (!s || (s.type !== "arrow" && s.type !== "line")) continue;
      const startId = s.start?.id as string | undefined;
      const endId = s.end?.id as string | undefined;
      if ((startId && !idSet.has(startId)) || (endId && !idSet.has(endId))) {
        return null;
      }
    }

    const mod = (await import("@excalidraw/excalidraw")) as any;
    const fn = mod.convertToExcalidrawElements as ((s: any, o?: any) => ExcalidrawElement[]) | undefined;
    if (!fn) return null;
    return fn(skeletons, opts);
  } catch (err) {
    console.warn("[skeleton-utils] convertToExcalidrawElements failed", err);
    return null;
  }
}
