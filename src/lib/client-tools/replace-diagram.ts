/**
 * replaceDiagramWithMermaid - Client-side tool implementation
 * 
 * Replaces existing diagram with a new one from Mermaid syntax.
 * Requires user confirmation before execution.
 */

import { parseMermaidSyntax } from "./mermaid-utils";
import type { AddToolOutputFn, MermaidToolResult } from "./types";

export const TOOL_NAME = "replaceDiagramWithMermaid";

/**
 * Execute replacement after user confirms
 */
export async function executeWithConfirmation(
  toolCallId: string,
  mermaidSyntax: string,
  addToolOutput: AddToolOutputFn
): Promise<MermaidToolResult> {
  console.log("[replaceDiagramWithMermaid] User confirmed, processing:", mermaidSyntax);
  
  const result = await parseMermaidSyntax(mermaidSyntax, "replace");
  
  const output: MermaidToolResult = {
    ...result,
    userConfirmed: true,
  };
  
  addToolOutput({
    tool: TOOL_NAME,
    toolCallId,
    state: "output-available",
    output,
  });
  
  return result;
}

/**
 * Handle user rejection
 */
export function executeRejection(
  toolCallId: string,
  addToolOutput: AddToolOutputFn
): void {
  console.log("[replaceDiagramWithMermaid] User rejected");
  
  const output: MermaidToolResult = {
    success: false,
    action: "replace",
    userConfirmed: false,
    message: "User cancelled the replace operation.",
  };
  
  addToolOutput({
    tool: TOOL_NAME,
    toolCallId,
    state: "output-available",
    output,
  });
}

/**
 * Check if this tool should handle the given tool call
 */
export function matches(toolName: string): boolean {
  return toolName === TOOL_NAME;
}

/**
 * Check if this tool requires user confirmation
 */
export function requiresConfirmation(): boolean {
  return true;
}
