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
    inputSchema: z.union([
      z.object({
        mermaid: z.string().describe("Valid Mermaid diagram syntax - must follow diagram-specific rules above"),
      }),
      z.object({
        mermaidCode: z.string().describe("Alias of mermaid; valid Mermaid syntax"),
        mermaid: z.string().optional(),
      }),
    ]),
  },
  
  replaceDiagramWithMermaid: {
    description: `Replace existing diagram with new Mermaid syntax. Requires user confirmation before execution.

${MERMAID_SYNTAX_GUIDE}

Generate syntactically correct Mermaid code following the rules above. User will see a confirmation dialog before replacement.`,
    inputSchema: z.union([
      z.object({
        mermaid: z.string().describe("Valid Mermaid diagram syntax - must follow diagram-specific rules above"),
      }),
      z.object({
        mermaidCode: z.string().describe("Alias of mermaid; valid Mermaid syntax"),
        mermaid: z.string().optional(),
      }),
    ]),
  },
  insertNode: {
    description: "Insert a node into the current diagram. Supports relative placement around an existing node. Id will be auto-generated; do NOT provide id.",
    inputSchema: z
      .object({
        label: z.string().optional(),
        type: z.enum(["rectangle", "diamond", "ellipse", "text", "image", "iframe", "embeddable", "frame", "magicframe", "freedraw"]),
        x: z.number().optional(),
        y: z.number().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        relativeTo: z.string().optional(),
        placement: z.enum(["above", "below", "left", "right"]).optional(),
        meta: z.record(z.string(), z.any()).optional(),
        fileId: z.string().optional(),
        points: z.array(z.tuple([z.number(), z.number()])).optional(),
      })
      .strip(),
  },
  updateNode: {
    description: "Update an existing node (position, size, label, type, meta).",
    inputSchema: z.object({
      id: z.string(),
      label: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
      type: z.string().optional(),
      meta: z.record(z.string(), z.any()).optional(),
      points: z.array(z.tuple([z.number(), z.number()])).optional(),
    }),
  },
  deleteNode: {
    description: "Delete a node and any edges referencing it.",
    inputSchema: z.object({ id: z.string() }),
  },
  batchUpdateNodes: {
    description: "Apply multiple node updates in one call.",
    inputSchema: z.object({
      updates: z.array(
        z.object({
          id: z.string(),
          x: z.number().optional(),
          y: z.number().optional(),
          label: z.string().optional(),
          width: z.number().optional(),
          height: z.number().optional(),
          type: z.string().optional(),
        })
      ),
    }),
  },
  insertEdge: {
    description: "Insert an edge/arrow between two nodes. Supports line/arrow/elbow-arrow. Id will be auto-generated; do NOT provide id.",
    inputSchema: z
      .object({
        from: z.string(),
        to: z.string(),
        type: z.enum(["line", "arrow", "elbow-arrow", "curved-arrow"]).optional(),
        startArrow: z.boolean().optional(),
        endArrow: z.boolean().optional(),
        label: z.string().optional(),
        via: z.array(z.tuple([z.number(), z.number()])).optional(),
      })
      .strip(),
  },
  updateEdge: {
    description:
      "Update an existing edge (endpoints, type, arrowheads, label, via/points). If from/to not provided, keeps existing bindings.",
    inputSchema: z
      .object({
        id: z.string().describe("Existing edge id"),
        from: z.string().optional(),
        to: z.string().optional(),
        type: z.enum(["line", "arrow", "elbow-arrow", "curved-arrow"]).optional(),
        startArrow: z.boolean().optional(),
        endArrow: z.boolean().optional(),
        label: z.string().optional(),
        via: z.array(z.tuple([z.number(), z.number()])).optional(),
        points: z.array(z.tuple([z.number(), z.number()])).optional(),
        meta: z.record(z.string(), z.any()).optional(),
      })
      .strip(),
  },
  deleteEdge: {
    description: "Delete an edge by id.",
    inputSchema: z.object({ id: z.string() }),
  },
  autoLayout: {
    description:
      "Run a simple force-directed layout to reduce overlaps. Optional nodes array limits which nodes move; otherwise all labeled rectangles/diamonds/ellipses are laid out. Use after severe overlaps.",
    inputSchema: z
      .object({
        nodes: z.array(z.string()).optional(),
        iterations: z.number().min(1).max(300).optional(),
      })
      .strip(),
  },
};

/**
 * Type-safe tool names
 */
export const TOOL_NAMES = {
  CREATE_DIAGRAM: "createDiagramFromMermaid",
  REPLACE_DIAGRAM: "replaceDiagramWithMermaid",
  INSERT_NODE: "insertNode",
  UPDATE_NODE: "updateNode",
  DELETE_NODE: "deleteNode",
  BATCH_UPDATE_NODES: "batchUpdateNodes",
  INSERT_EDGE: "insertEdge",
  UPDATE_EDGE: "updateEdge",
  DELETE_EDGE: "deleteEdge",
  AUTO_LAYOUT: "autoLayout",
} as const;

export type ToolName = typeof TOOL_NAMES[keyof typeof TOOL_NAMES];
