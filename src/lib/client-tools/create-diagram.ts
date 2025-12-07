/**
 * createDiagramFromMermaid - Client-side tool implementation
 * 
 * Creates a new diagram from Mermaid syntax. Executes automatically
 * when called by LLM, no user confirmation required.
 */

import { parseMermaidSyntax } from "./mermaid-utils";
import type { ToolCallInfo, AddToolOutputFn } from "./types";

export const TOOL_NAME = "createDiagramFromMermaid";

/**
 * Execute the createDiagramFromMermaid tool
 * This is automatically executed in onToolCall callback
 * 
 * @param toolCall - Tool call information
 * @param addToolOutput - Function to return tool output to LLM
 * @param canvasEmpty - Whether the Excalidraw canvas is currently empty
 */
export async function execute(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutputFn,
  canvasEmpty: boolean
): Promise<void> {
  const mermaidSyntax = toolCall.input?.mermaid ?? toolCall.input?.mermaidCode;
  
  if (!mermaidSyntax) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: "No mermaid syntax provided",
    });
    return;
  }

  // Check if canvas is empty - createDiagramFromMermaid only works on empty canvas
  if (!canvasEmpty) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: "Canvas is not empty",
    });
    return;
  }

  console.log("[createDiagramFromMermaid] Processing:", mermaidSyntax);
  
  const result = await parseMermaidSyntax(mermaidSyntax, "create");
  
  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    state: "output-available",
    output: result,
  });
}

/**
 * Check if this tool should handle the given tool call
 */
export function matches(toolName: string): boolean {
  return toolName === TOOL_NAME;
}
