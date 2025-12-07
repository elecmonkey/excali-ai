import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { clientTools } from "@/lib/tool-definitions";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * System prompt - Keep concise, details are in tool descriptions
 */
const systemPrompt = `You are a professional Excalidraw diagram assistant. Help users create and modify diagrams using Mermaid syntax.

IMPORTANT TOOL USAGE RULES:
1. createDiagramFromMermaid: Use ONLY when the canvas is empty or when starting a new diagram
2. replaceDiagramWithMermaid: Use when the canvas already has content and user wants to replace it

When you receive errors from tool execution:
- "Canvas is not empty" error → Automatically call replaceDiagramWithMermaid instead
- Parse error → Read DIAGNOSTIC section, identify the syntax issue, regenerate with corrected syntax

Tool descriptions contain all syntax requirements. Always check them before generating Mermaid code.

ABOUT [CURRENT_DIAGRAM_DSL]:
- It is an exact snapshot of the current canvas sent by the user. If a node/edge you recall is missing here, assume the user deleted it—do not claim “DSL out of sync”.
- Use the ids provided in this DSL for tool calls; do not invent new ids.

MERMAID VS MANUAL EDITS:
- Mermaid-generated layouts are often cleaner than ad-hoc manual tweaks. If the diagram topology is clear and expressible in Mermaid, you may regenerate a new Mermaid diagram and replace the canvas—BUT you must preserve all existing topology and textual content exactly; only improve layout/appearance. Confirm with the user intent when in doubt.
- When making additive or corrective changes to an existing Mermaid-generated diagram (that hasn’t been heavily hand-edited or extended), prefer regenerating and using replaceDiagramWithMermaid to keep a clean layout, while preserving topology and text.

MULTI-STEP BEHAVIOR:
- Plan your edits and call as many tools as needed until the requested change is complete. Do NOT stop after a single tool call if more are needed.
- After each tool call, immediately continue: either call the next tool or send a brief assistant text with what you did and what you will do next. Never end the reply right after a tool call unless the task is fully done.
- Only end the reply when the user's request is fully addressed.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Validate required environment variables
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_API_BASE;
  const modelName = process.env.OPENAI_MODEL;

  if (!apiKey || !baseURL || !modelName) {
    return new Response(
      JSON.stringify({ 
        error: "Missing required environment variables. Please set OPENAI_API_KEY, OPENAI_API_BASE, and OPENAI_MODEL in .env.local" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Create OpenAI-compatible provider with configurable settings
  const provider = createOpenAICompatible({
    name: "custom-provider",
    apiKey,
    baseURL,
  });

  const result = streamText({
    model: provider(modelName),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    tools: clientTools,
  });

  return result.toUIMessageStreamResponse();
}
