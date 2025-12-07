import { z } from "zod";
import type { AddToolOutputFn, ToolCallInfo, SceneToolResult, ExcalidrawElement } from "./types";
import { readScene, writeScene, type CanvasOps } from "./scene-utils";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

export const TOOL_NAME = "insertEdge";

const schema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  type: z.enum(["line", "arrow", "elbow-arrow", "curved-arrow"]).optional(),
  startArrow: z.boolean().optional(),
  endArrow: z.boolean().optional(),
  label: z.string().optional(),
  via: z.array(z.tuple([z.number(), z.number()])).optional(),
});

export async function execute(
  toolCall: ToolCallInfo,
  addToolOutput: AddToolOutputFn,
  canvasOps?: CanvasOps
) {
  const parsed = schema.safeParse(toolCall.input);
  if (!parsed.success) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: { success: false, action: "insert-edge", error: parsed.error.message },
    });
    return;
  }

  const { elements, files } = readScene(canvasOps);
  if (elements.some((el) => el.id === parsed.data.id)) {
    addToolOutput({
      tool: TOOL_NAME,
      toolCallId: toolCall.toolCallId,
      output: { success: false, action: "insert-edge", error: `Edge ${parsed.data.id} already exists` },
    });
    return;
  }

  const points: [number, number][] = [
    [0, 0],
    ...(parsed.data.via || []),
    [100, 0],
  ];

  const el: ExcalidrawElement = {
    id: parsed.data.id,
    type: parsed.data.type === "line" ? "line" : "arrow",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    points: points as any,
    // bindings set below
  };

  (el as any).startBinding = { elementId: parsed.data.from, focus: 0 };
  (el as any).endBinding = { elementId: parsed.data.to, focus: 0 };

  if (parsed.data.startArrow !== undefined) (el as any).startArrowhead = parsed.data.startArrow ? "arrow" : null;
  if (parsed.data.endArrow !== undefined) (el as any).endArrowhead = parsed.data.endArrow ? "arrow" : null;
  if (parsed.data.type === "elbow-arrow") (el as any).elbowed = true;
  if (parsed.data.label) (el as any).label = parsed.data.label;

  const nextElements = [...elements, el];
  writeScene(canvasOps, nextElements, files as BinaryFiles);

  const output: SceneToolResult = {
    success: true,
    action: "insert-edge",
    elements: nextElements,
    files,
  };

  addToolOutput({
    tool: TOOL_NAME,
    toolCallId: toolCall.toolCallId,
    output,
  });
}

export function matches(toolName: string) {
  return toolName === TOOL_NAME;
}
