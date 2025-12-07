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
