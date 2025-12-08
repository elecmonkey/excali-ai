import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { clientTools } from "@/lib/tool-definitions";
import { SYSTEM_PROMPT } from "@/lib/prompts/system-prompt";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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
    system: SYSTEM_PROMPT,
    messages: convertToModelMessages(messages),
    tools: clientTools,
  });

  return result.toUIMessageStreamResponse();
}
