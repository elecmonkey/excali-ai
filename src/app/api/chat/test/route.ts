import { NextResponse } from "next/server";

type ProviderConfig = { apiKey?: string; baseURL?: string; model?: string };

export async function POST(req: Request) {
  const { provider }: { provider?: ProviderConfig } = await req.json();

const cfg: ProviderConfig = {
    apiKey: provider?.apiKey || process.env.OPENAI_API_KEY,
    baseURL: provider?.baseURL || process.env.OPENAI_API_BASE,
    model: provider?.model || process.env.OPENAI_MODEL,
  };

  if (!cfg.apiKey || !cfg.baseURL || !cfg.model) {
    return NextResponse.json({ ok: false, error: "Missing provider config" }, { status: 400 });
  }

  // Health check aligned with actual call: try chat/completions; fallback to /v1/chat/completions
  try {
    const base = (cfg.baseURL || "").replace(/\/+$/, "");
    const candidates = [base + "/chat/completions", base + "/v1/chat/completions"];
    let lastErr: { status?: number; statusText?: string; error?: string } | null = null;
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: "ping" }], stream: false }),
        });
        if (res.ok) {
          return NextResponse.json({ ok: true, endpoint: url });
        }
        lastErr = { status: res.status, statusText: res.statusText };
      } catch (err: any) {
        lastErr = { error: err?.message || "Network error" };
      }
    }
    return NextResponse.json({ ok: false, ...lastErr }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Network error" }, { status: 200 });
  }
}
