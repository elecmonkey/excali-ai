"use client";

import { GitHubIcon } from "../GitHubIcon";
import { SettingsIcon } from "./SettingsIcon";
import { useState } from "react";

interface ChatHeaderProps {
  onOpenSettings: () => void;
  hasProvider: boolean;
}

export function ChatHeader({ onOpenSettings, hasProvider }: ChatHeaderProps) {
  const [showTip, setShowTip] = useState(false);

  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-3 relative">
      <div className="flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full ${hasProvider ? "bg-green-500" : "bg-red-500"} cursor-pointer`}
          onMouseEnter={() => !hasProvider && setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        />
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Chat with AI Assistant
        </h2>
        {!hasProvider && showTip && (
          <div className="absolute top-10 left-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg rounded-md px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100">
            Please configure LLM in Settings.
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Provider Settings"
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
        <a
          href="https://github.com/elecmonkey/excali-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
          aria-label="View on GitHub"
        >
          <GitHubIcon className="w-6 h-6" width={24} height={24} />
        </a>
      </div>
    </div>
  );
}
