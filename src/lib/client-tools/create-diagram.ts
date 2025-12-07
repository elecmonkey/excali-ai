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
 */
export async function execute(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutputFn
): Promise<void> {
  const mermaidSyntax = toolCall.input?.mermaid;
  
  if (!mermaidSyntax) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: {
        success: false,
        action: "create",
        error: "No mermaid syntax provided",
        message: "The mermaid parameter is required. Please provide valid Mermaid syntax.",
      },
    });
    return;
  }

  console.log("[createDiagramFromMermaid] Processing:", mermaidSyntax);
  
  const result = await parseMermaidSyntax(mermaidSyntax, "create");
  
  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    output: result,
  });
}

/**
 * Check if this tool should handle the given tool call
 */
export function matches(toolName: string): boolean {
  return toolName === TOOL_NAME;
}
