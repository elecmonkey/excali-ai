/**
 * Mermaid to Excalidraw conversion utilities
 */

import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawElement, MermaidToolResult } from "./types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

/**
 * Parse Mermaid syntax and convert to Excalidraw elements
 * Returns a result object that can be sent back to LLM
 */
export async function parseMermaidSyntax(
  mermaidSyntax: string,
  action: "create" | "replace"
): Promise<MermaidToolResult> {
  try {
    const { elements: skeletonElements, files } = await parseMermaidToExcalidraw(
      mermaidSyntax,
      {}
    );
    
    const excalidrawElements = convertToExcalidrawElements(skeletonElements);

    return {
      success: true,
      action,
      elements: excalidrawElements as ExcalidrawElement[],
      files: (files || {}) as BinaryFiles,
      mermaidSyntax,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[Mermaid Parse Error] ${action}:`, errorMessage);
    
    return {
      success: false,
      action,
      error: errorMessage,
      mermaidSyntax,
      message: `Mermaid syntax parse error: ${errorMessage}. Please check the syntax and generate correct Mermaid code.`,
    };
  }
}

/**
 * Apply Mermaid result to Excalidraw canvas
 */
export function applyMermaidResultToCanvas(
  result: MermaidToolResult,
  clearScene: () => void,
  updateScene: (elements: ExcalidrawElement[], files?: BinaryFiles) => void,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getExcalidrawAPI: () => any
): void {
  if (!result.success || !result.elements) {
    return;
  }

  clearScene();
  
  setTimeout(() => {
    updateScene(result.elements!, result.files);
    
    const api = getExcalidrawAPI();
    if (api?.scrollToContent) {
      api.scrollToContent(result.elements, { fitToContent: true });
    }
  }, 100);
}
