/**
 * Client-side tool definitions
 * These are registered with the AI SDK but executed in the browser
 */

import { z } from "zod";
import { MERMAID_SYNTAX_GUIDE } from "./mermaid-syntax-guide";

/**
 * Tool definitions for Vercel AI SDK
 * The description field is automatically sent to LLM with tool schema
 */
export const clientTools = {
  createDiagramFromMermaid: {
    description: `Create a new diagram from Mermaid syntax. Use when user wants a new diagram or canvas is empty.

${MERMAID_SYNTAX_GUIDE}

Generate syntactically correct Mermaid code following the rules above. Verify diagram type and syntax before calling this tool.`,
    inputSchema: z.object({
      mermaid: z.string().describe("Valid Mermaid diagram syntax - must follow diagram-specific rules above"),
    }),
  },
  
  replaceDiagramWithMermaid: {
    description: `Replace existing diagram with new Mermaid syntax. Requires user confirmation before execution.

${MERMAID_SYNTAX_GUIDE}

Generate syntactically correct Mermaid code following the rules above. User will see a confirmation dialog before replacement.`,
    inputSchema: z.object({
      mermaid: z.string().describe("Valid Mermaid diagram syntax - must follow diagram-specific rules above"),
    }),
  },
};

/**
 * Type-safe tool names
 */
export const TOOL_NAMES = {
  CREATE_DIAGRAM: "createDiagramFromMermaid",
  REPLACE_DIAGRAM: "replaceDiagramWithMermaid",
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
