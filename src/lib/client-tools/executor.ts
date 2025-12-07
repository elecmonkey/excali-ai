/**
 * Client-side tool executor
 * 
 * Centralized execution of client-side tools with proper error handling.
 * Ensures errors are captured and returned to LLM for retry.
 */

import * as createDiagram from "./create-diagram";
import * as replaceDiagram from "./replace-diagram";
import * as insertNode from "./insert-node";
import * as updateNode from "./update-node";
import * as deleteNode from "./delete-node";
import * as batchUpdateNodes from "./batch-update-nodes";
import * as insertEdge from "./insert-edge";
import * as updateEdge from "./update-edge";
import * as deleteEdge from "./delete-edge";
import { applyMermaidResultToCanvas } from "./mermaid-utils";
import type { 
  ToolCallInfo, 
  AddToolOutputFn, 
  MermaidToolResult,
  ExcalidrawElement,
} from "./types";
import type { SceneToolResult } from "./types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import type { CanvasOps } from "./scene-utils";

// Re-export tool names for external use
export const TOOL_NAMES = {
  CREATE_DIAGRAM: createDiagram.TOOL_NAME,
  REPLACE_DIAGRAM: replaceDiagram.TOOL_NAME,
  INSERT_NODE: insertNode.TOOL_NAME,
  UPDATE_NODE: updateNode.TOOL_NAME,
  DELETE_NODE: deleteNode.TOOL_NAME,
  BATCH_UPDATE_NODES: batchUpdateNodes.TOOL_NAME,
  INSERT_EDGE: insertEdge.TOOL_NAME,
  UPDATE_EDGE: updateEdge.TOOL_NAME,
  DELETE_EDGE: deleteEdge.TOOL_NAME,
} as const;

/**
 * Execute a tool call automatically (for onToolCall callback)
 * Only executes tools that don't require user confirmation
 * 
 * @param toolCall - Tool call information
 * @param addToolOutput - Function to return tool output
 * @param canvasEmpty - Whether the Excalidraw canvas is currently empty
 */
export async function executeAutoTool(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutputFn,
  canvasEmpty: boolean = true,
  canvasOps?: CanvasOps
): Promise<boolean> {
  // Skip dynamic tools
  if (toolCall.dynamic) {
    return false;
  }

  try {
    // createDiagramFromMermaid - auto execute only if canvas is empty
    if (createDiagram.matches(toolCall.toolName)) {
      await createDiagram.execute(toolCall, addToolOutput, canvasEmpty);
      return true;
    }
    
    // replaceDiagramWithMermaid - requires confirmation, don't auto execute
    if (replaceDiagram.matches(toolCall.toolName)) {
      // Do nothing here, will be handled by UI
      return false;
    }

    if (insertNode.matches(toolCall.toolName)) {
      await insertNode.execute(toolCall, addToolOutput, canvasOps);
      return true;
    }

    if (updateNode.matches(toolCall.toolName)) {
      await updateNode.execute(toolCall, addToolOutput, canvasOps);
      return true;
    }

    if (deleteNode.matches(toolCall.toolName)) {
      await deleteNode.execute(toolCall, addToolOutput, canvasOps);
      return true;
    }

    if (batchUpdateNodes.matches(toolCall.toolName)) {
      await batchUpdateNodes.execute(toolCall, addToolOutput, canvasOps);
      return true;
    }

    if (insertEdge.matches(toolCall.toolName)) {
      await insertEdge.execute(toolCall, addToolOutput, canvasOps);
      return true;
    }

    if (updateEdge.matches(toolCall.toolName)) {
      await updateEdge.execute(toolCall, addToolOutput, canvasOps);
      return true;
    }

    if (deleteEdge.matches(toolCall.toolName)) {
      await deleteEdge.execute(toolCall, addToolOutput, canvasOps);
      return true;
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
  result: MermaidToolResult | SceneToolResult,
  canvasOps: {
    clearScene: () => void;
    updateScene: (elements: ExcalidrawElement[], files?: BinaryFiles) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getExcalidrawAPI: () => any;
  }
): void {
  if (!result.success || !result.elements) return;

  try {
    console.debug("[applyToolResultToCanvas] applying", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      action: (result as any).action,
      count: result.elements?.length,
    });
    // For create/replace, keep the existing behavior (clear then set)
    if ((result as MermaidToolResult).action === "create" || (result as MermaidToolResult).action === "replace") {
      applyMermaidResultToCanvas(
        result as MermaidToolResult,
        canvasOps.clearScene,
        canvasOps.updateScene,
        canvasOps.getExcalidrawAPI
      );
      return;
    }

    // For incremental scene tools, just update the scene without clearing
    canvasOps.updateScene(result.elements, (result as SceneToolResult).files);
  } catch (err) {
    console.error("[applyToolResultToCanvas] failed to apply result", err);
  }
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
