import type { ExcalidrawElement } from "./types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export interface CanvasOps {
  clearScene: () => void;
  updateScene: (elements: ExcalidrawElement[], files?: BinaryFiles) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getExcalidrawAPI: () => any;
}

export function readScene(canvasOps?: CanvasOps): {
  elements: ExcalidrawElement[];
  files: BinaryFiles;
} {
  const api = canvasOps?.getExcalidrawAPI();
  if (!api) {
    console.warn("[scene-utils] Excalidraw API not available; returning empty scene");
  }
  const elements = api?.getSceneElements ? Array.from(api.getSceneElements() as ExcalidrawElement[]) : [];
  const files = api?.getFiles ? (api.getFiles() as BinaryFiles) : {};
  console.debug("[scene-utils] readScene", { count: elements.length, fileCount: Object.keys(files).length });
  return { elements, files };
}

export function writeScene(
  canvasOps: CanvasOps | undefined,
  elements: ExcalidrawElement[],
  files?: BinaryFiles
) {
  if (!canvasOps) return;
  console.debug("[scene-utils] writeScene", {
    count: elements.length,
    fileCount: files ? Object.keys(files).length : 0,
  });
  canvasOps.updateScene(elements, files);
}

export function createDefaultElement(params: {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
}): ExcalidrawElement {
  const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  const base: ExcalidrawElement = {
    id: params.id,
    type: params.type,
    x: params.x ?? 0,
    y: params.y ?? 0,
    width: params.width ?? 160,
    height: params.height ?? 80,
    angle: 0,
    strokeColor: "#1e1e1e",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null as unknown as undefined,
    seed,
    version: 1,
    versionNonce: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
    isDeleted: false,
    boundElements: [],
    link: null as unknown as undefined,
    locked: false,
  };

  if (params.type === "text") {
    (base as any).text = params.label ?? "";
    (base as any).fontSize = 20;
    (base as any).fontFamily = 1;
    (base as any).textAlign = "left";
    (base as any).verticalAlign = "top";
    (base as any).baseline = 18;
    (base as any).lineHeight = 1.25;
  }

  return base;
}
