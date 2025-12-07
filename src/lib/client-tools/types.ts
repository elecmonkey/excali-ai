/**
 * Client-side tool types and interfaces
 */

import type { BinaryFiles } from "@excalidraw/excalidraw/types";

// Excalidraw element type (simplified, actual type is complex)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExcalidrawElement = Record<string, any>;

/**
 * Base result for all tool executions
 */
export interface ToolResultBase {
  success: boolean;
  action: string;
  message?: string;
  error?: string;
}

/**
 * Result for Mermaid diagram tools
 */
export interface MermaidToolResult extends ToolResultBase {
  action: "create" | "replace";
  elements?: ExcalidrawElement[];
  files?: BinaryFiles;
  mermaidSyntax?: string;
  userConfirmed?: boolean;
}

/**
 * Result for generic scene tools (node/edge operations)
 */
export interface SceneToolResult extends ToolResultBase {
  elements?: ExcalidrawElement[];
  files?: BinaryFiles;
  newId?: string;
}

/**
 * Tool call information from AI SDK
 */
export interface ToolCallInfo {
  toolCallId: string;
  toolName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: any;
  dynamic?: boolean;
}

/**
 * Function signature for adding tool output
 * Matches the SDK's discriminated union type
 */
export type AddToolOutputFn = (
  options:
    | {
        state?: "output-available";
        tool: string;
        toolCallId: string;
        output: unknown;
        errorText?: undefined;
      }
    | {
        state: "output-error";
        tool: string;
        toolCallId: string;
        output?: undefined;
        errorText: string;
      }
) => void;

/**
 * Context passed to tool executors
 */
export interface ToolExecutionContext {
  addToolOutput: AddToolOutputFn;
  // Excalidraw operations
  updateScene: (elements: ExcalidrawElement[], files?: BinaryFiles) => void;
  clearScene: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getExcalidrawAPI: () => any;
}

/**
 * Tool executor function signature
 */
export type ToolExecutor = (
  toolCall: ToolCallInfo,
  context: ToolExecutionContext
) => Promise<void>;

/**
 * Interactive tool handler for user confirmation
 */
export interface InteractiveToolHandler {
  confirm: (toolCallId: string, input: unknown) => Promise<void>;
  reject: (toolCallId: string) => void;
}
