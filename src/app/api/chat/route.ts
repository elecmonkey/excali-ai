import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { convertToModelMessages, streamText, UIMessage } from "ai";
import { clientTools } from "@/lib/tool-definitions";
import { SYSTEM_PROMPT } from "@/lib/prompts/system-prompt";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  header.split(/; */).forEach((part) => {
    const [k, ...v] = part.split("=");
    if (!k) return;
    out[decodeURIComponent(k.trim())] = decodeURIComponent(v.join("="));
  });
  return out;
}

const normalizeBaseURL = (url: string) => {
  let u = url.trim();
  // strip trailing slashes only; do not strip version segments (v1/v4 etc.)
  u = u.replace(/\/+$/, "");
  return u;
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const cookies = parseCookies(req.headers.get("cookie"));
  const clientCfgStr = cookies["providerConfig"];
  let clientCfg: { apiKey?: string; baseURL?: string; model?: string } | undefined;
  try {
    clientCfg = clientCfgStr ? JSON.parse(clientCfgStr) : undefined;
  } catch {
    clientCfg = undefined;
  }
  const useServerOverride = cookies["useServer"];

  const serverConfig = {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE,
    model: process.env.OPENAI_MODEL,
  };

  const useClient = useServerOverride === "false" || (!serverConfig.apiKey || !serverConfig.baseURL || !serverConfig.model);
  const selected = useClient ? clientCfg : serverConfig;

  const apiKey = selected?.apiKey;
  const baseURL = selected?.baseURL ? normalizeBaseURL(selected.baseURL) : undefined;
  const modelName = selected?.model;

  if (!apiKey || !baseURL || !modelName) {
    return new Response(
      JSON.stringify({ error: "Missing provider configuration. Please set server env or provide client settings." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
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
