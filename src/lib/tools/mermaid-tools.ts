import { z } from "zod";
import { tool } from "ai";

// Mermaid tools - conversion happens on the client side
// Server only validates and passes the mermaid syntax

/**
 * Tool: createDiagramFromMermaid
 * Create a new diagram from Mermaid syntax.
 * Used when the canvas is empty or user explicitly asks to create a new diagram.
 */
export const createDiagramFromMermaid = tool({
  description: `Create a new diagram from Mermaid syntax. 
Use this when the canvas is empty or the user explicitly asks to create a new diagram.
This will clear any existing diagram and replace it with the new one.
Supported diagram types: flowcharts (TD, LR, TB, RL), with rectangles, diamonds, ellipses, and arrows.`,
  inputSchema: z.object({
    mermaid: z.string().describe("The Mermaid diagram syntax (e.g., 'flowchart TD\\n  A[Start] --> B[End]')"),
  }),
  execute: async ({ mermaid }) => {
    // Server-side: just validate and return the mermaid syntax
    // Client-side will handle the actual conversion using @excalidraw libraries
    return {
      success: true,
      action: "create" as const,
      mermaidSyntax: mermaid,
      requiresClientConversion: true,
      message: `Mermaid syntax ready for conversion`,
    };
  },
});

/**
 * Tool: replaceDiagramWithMermaid
 * Replace the current diagram with a newly generated one from Mermaid.
 * Requires explicit user intent (e.g., "replace", "rebuild", "regenerate").
 */
export const replaceDiagramWithMermaid = tool({
  description: `Replace the current diagram with a newly generated one from Mermaid syntax.
Use this when the user explicitly wants to replace, rebuild, or regenerate the entire diagram.
This will fully overwrite the existing diagram.
Requires explicit user intent.`,
  inputSchema: z.object({
    mermaid: z.string().describe("The Mermaid diagram syntax to replace the current diagram"),
  }),
  execute: async ({ mermaid }) => {
    return {
      success: true,
      action: "replace" as const,
      mermaidSyntax: mermaid,
      requiresClientConversion: true,
      message: `Mermaid syntax ready for conversion`,
    };
  },
});

// Export all mermaid tools
export const mermaidTools = {
  createDiagramFromMermaid,
  replaceDiagramWithMermaid,
};
