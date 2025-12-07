import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { z } from "zod";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const systemPrompt = `You are a professional Excalidraw diagram assistant. You can help users:
1. Create new diagrams from Mermaid syntax
2. Replace existing diagrams with Mermaid syntax

When users describe the diagram they want, you should:
1. Understand user requirements
2. Generate appropriate Mermaid syntax
3. Call the corresponding tool to create or replace the diagram

Supported Mermaid diagram types include:
- flowchart/graph: Flow diagrams
- sequenceDiagram: Sequence diagrams
- classDiagram: Class diagrams
- stateDiagram: State diagrams
- erDiagram: Entity relationship diagrams
- pie: Pie charts
- gantt: Gantt charts

IMPORTANT Mermaid syntax rules:
1. Avoid special characters in node labels, especially parentheses ()
2. Use simple text or wrap complex labels in quotes
3. For abbreviations like "HMR", use: A[HMR - Hot Module Replacement]
4. Test your syntax mentally before outputting

Always use clear, accurate Mermaid syntax. If a tool call fails due to syntax error, analyze the error message and retry with corrected syntax.`;

// Client-side tool definitions (no execute function - executed in browser)
const clientTools = {
  createDiagramFromMermaid: {
    description: `Create a new diagram from Mermaid syntax. Use this when the user wants to create a new diagram or there is no existing diagram on the canvas.`,
    inputSchema: z.object({
      mermaid: z.string().describe("The Mermaid diagram syntax to convert to Excalidraw format"),
    }),
  },
  replaceDiagramWithMermaid: {
    description: `Replace the existing diagram with a new one from Mermaid syntax. Use this when the user wants to modify or replace an existing diagram. Requires user confirmation.`,
    inputSchema: z.object({
      mermaid: z.string().describe("The Mermaid diagram syntax to convert to Excalidraw format"),
    }),
  },
};

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
