import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { clientTools } from "@/lib/tool-definitions";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * System prompt - Keep concise, details are in tool descriptions
 */
const systemPrompt = `You are a professional Excalidraw diagram assistant. Help users create and modify diagrams using Mermaid syntax.

When you receive a parse error from tool execution:
1. Read the DIAGNOSTIC section in the error message carefully
2. Identify which syntax rule was violated
3. Regenerate the diagram with corrected syntax
4. Explain to the user what was fixed

Always check tool descriptions for diagram-specific syntax requirements before generating Mermaid code.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // Create OpenAI-compatible provider configured for BigModel API
  const bigmodel = createOpenAICompatible({
    name: "bigmodel",
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
  });

  const result = streamText({
    model: bigmodel("glm-4-flash"),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    tools: clientTools,
  });

  return result.toUIMessageStreamResponse();
}
