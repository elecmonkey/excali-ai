"use client";

import { GitHubIcon } from "../GitHubIcon";
import { SettingsIcon } from "./SettingsIcon";

interface ChatHeaderProps {
  onOpenSettings: () => void;
}

export function ChatHeader({ onOpenSettings }: ChatHeaderProps) {
  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center gap-3">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Chat with AI Assistant
      </h2>
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
