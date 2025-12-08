"use client";

import { GitHubIcon } from "../GitHubIcon";

export function ChatHeader() {
  return (
    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        Chat with AI Assistant
      </h2>
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
  );
}
