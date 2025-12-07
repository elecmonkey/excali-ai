import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, UIMessage } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

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
    messages: convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
