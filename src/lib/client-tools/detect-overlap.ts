import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import type { CanvasOps } from "./scene-utils";
import { readScene } from "./scene-utils";
import { detectOverlaps } from "../geometry/overlap";

export const TOOL_NAME = "detectOverlap";

const schema = z
  .object({
    minArea: z.number().optional().describe("Minimum intersection area to report (default 1)"),
  })
  .strip();

export async function execute(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutputFn,
  canvasOps?: CanvasOps
) {
  const parsed = schema.safeParse(toolCall.input ?? {});
  if (!parsed.success) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      state: "output-error",
      errorText: parsed.error.message,
    });
    return;
  }

  const { elements, files } = readScene(canvasOps);
  const overlaps = detectOverlaps(elements as ExcalidrawElement[], parsed.data.minArea ?? 1);

  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    state: "output-available",
    output: {
      success: true,
      action: "detect-overlap",
      message: `${overlaps.length} overlaps detected`,
      elements,
      files,
      overlaps,
    } as any,
  });
}

export function matches(toolName: string) {
  return toolName === TOOL_NAME;
}
