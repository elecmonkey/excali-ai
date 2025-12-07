/**
 * Mermaid to Excalidraw conversion utilities
 * Client-side only - uses dynamic imports to avoid SSR issues
 */

import type { ExcalidrawElement, MermaidToolResult } from "./types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

/**
 * Lazy load Excalidraw utilities (client-side only)
 */
async function getExcalidrawUtils() {
  const [
    { parseMermaidToExcalidraw },
    { convertToExcalidrawElements }
  ] = await Promise.all([
    import("@excalidraw/mermaid-to-excalidraw"),
    import("@excalidraw/excalidraw")
  ]);
  
  return { parseMermaidToExcalidraw, convertToExcalidrawElements };
}

/**
 * Detect diagram type from Mermaid syntax
 */
function detectDiagramType(syntax: string): string {
  const firstLine = syntax.trim().split('\n')[0].toLowerCase();
  if (firstLine.includes('classDiagram')) return 'classDiagram';
  if (firstLine.includes('sequenceDiagram')) return 'sequenceDiagram';
  if (firstLine.includes('erDiagram')) return 'erDiagram';
  if (firstLine.includes('stateDiagram')) return 'stateDiagram';
  if (firstLine.includes('gantt')) return 'gantt';
  if (firstLine.includes('pie')) return 'pie';
  if (firstLine.includes('graph') || firstLine.includes('flowchart')) return 'flowchart';
  return 'unknown';
}

/**
 * Generate diagnostic message based on error pattern and diagram type
 */
function generateDiagnostic(errorMessage: string, diagramType: string, syntax: string): string {
  const diagnostics: string[] = [];
  
  // classDiagram specific errors
  if (diagramType === 'classDiagram') {
    if (syntax.includes('extends')) {
      diagnostics.push('❌ classDiagram does NOT support "extends" keyword. Use: ClassName <|-- SubClass');
    }
    if (syntax.match(/--o>|o--o>|<o--|o--|--o/)) {
      diagnostics.push('❌ classDiagram does NOT support ER-style connectors (o--, --o, etc). Use: --> or <|-- only');
    }
    if (syntax.match(/-->\s*\w+\s*:/)) {
      diagnostics.push('❌ classDiagram does NOT support arrow labels. Remove ": label" from connections');
    }
    if (syntax.match(/\+\w+\s+\w+\(/)) {
      diagnostics.push('❌ classDiagram does NOT support type annotations. Use: +methodName() not +Type methodName()');
    }
  }
  
  // Special character errors
  if (errorMessage.includes('Expecting') && errorMessage.includes('got')) {
    if (syntax.match(/\[.*[[\]{}()].+\]/) && !syntax.includes('"')) {
      diagnostics.push('❌ Node labels with special characters [ ] { } ( ) must be quoted: A["label"]');
    }
  }
  
  // No diagram type detected
  if (errorMessage.includes('No diagram type detected')) {
    diagnostics.push('❌ Missing diagram type declaration. Start with: graph TD, classDiagram, sequenceDiagram, etc.');
  }
  
  return diagnostics.length > 0 
    ? `\n\nDIAGNOSTIC:\n${diagnostics.join('\n')}`
    : '';
}

/**
 * Parse Mermaid syntax and convert to Excalidraw elements
 * Returns a result object that can be sent back to LLM with detailed diagnostics
 */
export async function parseMermaidSyntax(
  mermaidSyntax: string,
  action: "create" | "replace"
): Promise<MermaidToolResult> {
  try {
    // Dynamic import to avoid SSR issues
    const { parseMermaidToExcalidraw, convertToExcalidrawElements } = await getExcalidrawUtils();
    
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
    const diagramType = detectDiagramType(mermaidSyntax);
    const diagnostic = generateDiagnostic(errorMessage, diagramType, mermaidSyntax);
    
    console.error(`[Mermaid Parse Error] ${action} (${diagramType}):`, errorMessage);
    
    const fullMessage = `Mermaid syntax error in ${diagramType}:

ERROR: ${errorMessage}${diagnostic}

ACTION REQUIRED: Regenerate the ${diagramType} with correct syntax. Review the diagram-specific rules in the system prompt.`;
    
    return {
      success: false,
      action,
      error: errorMessage,
      mermaidSyntax,
      message: fullMessage,
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
