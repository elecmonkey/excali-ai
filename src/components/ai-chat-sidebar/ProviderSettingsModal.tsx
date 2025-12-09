"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  serverConfig: { has: boolean; baseURL: string | null; model: string | null };
  useServer: boolean;
  clientConfig: { apiKey: string; baseURL: string; model: string };
  onToggleUseServer: (val: boolean) => void;
  onClientChange: (cfg: { apiKey: string; baseURL: string; model: string }) => void;
  onSaved?: () => void;
};

const templates = {
  openai: { baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  deepseek: { baseURL: "https://api.deepseek.com", model: "deepseek-chat" },
  bigmodel: { baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.6" },
};

export function ProviderSettingsModal({
  open,
  onClose,
  serverConfig,
  useServer,
  clientConfig,
  onToggleUseServer,
  onClientChange,
  onSaved,
}: Props) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!open) return null;

  const applyTemplate = (tpl: keyof typeof templates) => {
    const t = templates[tpl];
    onClientChange({ ...clientConfig, baseURL: t.baseURL, model: t.model });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/chat/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: useServer && serverConfig.has ? {} : clientConfig }),
      });
      const data = await res.json();
      if (data.ok) setTestResult("✅ Connected successfully");
      else setTestResult(`❌ ${data.error || data.statusText || "Connection failed"}`);
    } catch (err: any) {
      setTestResult(`❌ ${err?.message || "Network error"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40">
      <div className="w-[480px] max-w-[90vw] rounded-lg bg-surface border border-muted shadow-xl p-4 space-y-3 text-primary">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-primary">Provider Settings</h3>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="text-sm space-y-1 text-secondary">
          <div>Server config: {serverConfig.has ? "Available" : "Not set"}</div>
          {serverConfig.has && (
            <div className="text-xs text-secondary">URL: {serverConfig.baseURL || "-"} | Model: {serverConfig.model || "-"}</div>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <label className={`flex items-center gap-1 ${!serverConfig.has ? "text-zinc-400 dark:text-zinc-600" : ""}`}>
            <input
              type="radio"
              checked={useServer && serverConfig.has}
              disabled={!serverConfig.has}
              onChange={() => onToggleUseServer(true)}
            />
            Use server config
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={!useServer || !serverConfig.has}
              onChange={() => onToggleUseServer(false)}
            />
            Use client config
          </label>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex gap-2 text-xs text-secondary">
            Quick fill:
            <button className="underline" onClick={() => applyTemplate("openai")}>OpenAI</button>
            <button className="underline" onClick={() => applyTemplate("deepseek")}>DeepSeek</button>
            <button className="underline" onClick={() => applyTemplate("bigmodel")}>BigModel</button>
          </div>
          <input
            className="w-full px-3 py-2 rounded border border-muted bg-surface text-sm text-primary placeholder:text-secondary"
            placeholder="Base URL"
            value={clientConfig.baseURL}
            onChange={(e) => onClientChange({ ...clientConfig, baseURL: e.target.value })}
            disabled={useServer && serverConfig.has}
            aria-disabled={useServer && serverConfig.has}
            style={useServer && serverConfig.has ? { opacity: 0.6 } : undefined}
          />
          <input
            className="w-full px-3 py-2 rounded border border-muted bg-surface text-sm text-primary placeholder:text-secondary"
            placeholder="Model"
            value={clientConfig.model}
            onChange={(e) => onClientChange({ ...clientConfig, model: e.target.value })}
            disabled={useServer && serverConfig.has}
            aria-disabled={useServer && serverConfig.has}
            style={useServer && serverConfig.has ? { opacity: 0.6 } : undefined}
          />
          <input
            className="w-full px-3 py-2 rounded border border-muted bg-surface text-sm text-primary placeholder:text-secondary"
            placeholder="API Key"
            type="password"
            value={clientConfig.apiKey}
            onChange={(e) => onClientChange({ ...clientConfig, apiKey: e.target.value })}
            disabled={useServer && serverConfig.has}
            aria-disabled={useServer && serverConfig.has}
            style={useServer && serverConfig.has ? { opacity: 0.6 } : undefined}
          />
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-2 rounded bg-blue-500 text-white text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Test connectivity
          </button>
          {testResult && <div className="text-xs text-secondary">{testResult}</div>}
        </div>

        <div className="flex justify-end gap-2 text-sm">
          <button
            onClick={() => {
              document.cookie = `providerConfig=${encodeURIComponent(
                JSON.stringify({ apiKey: clientConfig.apiKey, baseURL: clientConfig.baseURL, model: clientConfig.model })
              )}; path=/; max-age=2592000`;
              document.cookie = `useServer=${useServer}; path=/; max-age=2592000`;
              localStorage.setItem("providerConfig", JSON.stringify({ useServer, client: clientConfig }));
              onSaved?.();
              onClose();
            }}
            className="px-4 py-2 rounded bg-muted text-primary hover:bg-divider transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
