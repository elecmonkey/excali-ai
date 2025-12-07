/**
 * Client-side tool executor
 * 
 * Centralized execution of client-side tools with proper error handling.
 * Ensures errors are captured and returned to LLM for retry.
 */

import * as createDiagram from "./create-diagram";
import * as replaceDiagram from "./replace-diagram";
import { applyMermaidResultToCanvas } from "./mermaid-utils";
import type { 
  ToolCallInfo, 
  AddToolOutputFn, 
  MermaidToolResult,
  ExcalidrawElement,
} from "./types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

// Re-export tool names for external use
export const TOOL_NAMES = {
  CREATE_DIAGRAM: createDiagram.TOOL_NAME,
  REPLACE_DIAGRAM: replaceDiagram.TOOL_NAME,
} as const;

/**
 * Execute a tool call automatically (for onToolCall callback)
 * Only executes tools that don't require user confirmation
 */
export async function executeAutoTool(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutputFn
): Promise<boolean> {
  // Skip dynamic tools
  if (toolCall.dynamic) {
    return false;
  }

  try {
    // createDiagramFromMermaid - auto execute
    if (createDiagram.matches(toolCall.toolName)) {
      await createDiagram.execute(toolCall, addToolOutput);
      return true;
    }
    
    // replaceDiagramWithMermaid - requires confirmation, don't auto execute
    if (replaceDiagram.matches(toolCall.toolName)) {
      // Do nothing here, will be handled by UI
      return false;
    }
    
    return false;
  } catch (error) {
    // Catch any unexpected errors and return to LLM
    console.error("[Tool Executor] Unexpected error:", error);
    
    addToolOutput({
      tool: toolCall.toolName,
      toolCallId: toolCall.toolCallId,
      output: {
        success: false,
        action: "unknown",
        error: error instanceof Error ? error.message : String(error),
        message: "An unexpected error occurred. Please try again.",
      },
    });
    
    return true;
  }
}

/**
 * Handle user confirmation for replace tool
 */
export async function confirmReplaceDiagram(
  toolCallId: string,
  mermaidSyntax: string,
  addToolOutput: AddToolOutputFn,
  canvasOps: {
    clearScene: () => void;
    updateScene: (elements: ExcalidrawElement[], files?: BinaryFiles) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getExcalidrawAPI: () => any;
  }
): Promise<void> {
  const result = await replaceDiagram.executeWithConfirmation(
    toolCallId,
    mermaidSyntax,
    addToolOutput
  );
  
  // Apply to canvas if successful
  if (result.success) {
    applyMermaidResultToCanvas(
      result,
      canvasOps.clearScene,
      canvasOps.updateScene,
      canvasOps.getExcalidrawAPI
    );
  }
}

/**
 * Handle user rejection for replace tool
 */
export function rejectReplaceDiagram(
  toolCallId: string,
  addToolOutput: AddToolOutputFn
): void {
  replaceDiagram.executeRejection(toolCallId, addToolOutput);
}

/**
 * Apply tool result to canvas (for use in useEffect)
 */
export function applyToolResultToCanvas(
  result: MermaidToolResult,
  canvasOps: {
    clearScene: () => void;
    updateScene: (elements: ExcalidrawElement[], files?: BinaryFiles) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getExcalidrawAPI: () => any;
  }
): void {
  applyMermaidResultToCanvas(
    result,
    canvasOps.clearScene,
    canvasOps.updateScene,
    canvasOps.getExcalidrawAPI
  );
}

/**
 * Check if a tool requires user confirmation
 */
export function requiresConfirmation(toolName: string): boolean {
  if (replaceDiagram.matches(toolName)) {
    return replaceDiagram.requiresConfirmation();
  }
  return false;
}
