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
  const elements = api?.getSceneElements ? Array.from(api.getSceneElements() as ExcalidrawElement[]) : [];
  const files = api?.getFiles ? (api.getFiles() as BinaryFiles) : {};
  return { elements, files };
}

export function writeScene(
  canvasOps: CanvasOps | undefined,
  elements: ExcalidrawElement[],
  files?: BinaryFiles
) {
  if (!canvasOps) return;
  canvasOps.updateScene(elements, files);
}
