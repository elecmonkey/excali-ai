"use client";

import { GitHubIcon } from "../GitHubIcon";
import { SettingsIcon } from "./SettingsIcon";
import { LightIcon } from "./LightIcon";
import { DarkIcon } from "./DarkIcon";
import { ConversationsIcon } from "./ConversationsIcon";
import { useEffect, useState, type RefObject } from "react";
import { useExcalidrawContext } from "@/lib/excalidraw-context";

interface ChatHeaderProps {
  onOpenSettings: () => void;
  hasProvider: boolean;
  onOpenConversations: () => void;
  conversationsButtonRef?: RefObject<HTMLButtonElement | null>;
  onNewConversation: () => void;
}

export function ChatHeader({
  onOpenSettings,
  hasProvider,
  onOpenConversations,
  conversationsButtonRef,
  onNewConversation,
}: ChatHeaderProps) {
  const [showTip, setShowTip] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useExcalidrawContext();

  // Avoid hydration mismatch by deferring to client for status color
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const resolvedStatus = mounted ? hasProvider : false;

  return (
    <div className="p-4 border-b border-muted flex justify-between items-center gap-3 relative bg-surface text-primary">
      <div className="flex items-center gap-2">
        <div
          className={`h-3 w-3 rounded-full ${resolvedStatus ? "bg-green-500" : "bg-red-500"} cursor-pointer`}
          onMouseEnter={() => !resolvedStatus && setShowTip(true)}
          onMouseLeave={() => setShowTip(false)}
        />
        <h2 className="text-lg font-semibold text-primary">
          Chat with AI
        </h2>
        {!resolvedStatus && showTip && (
          <div className="absolute top-10 left-0 bg-surface border border-muted shadow-lg rounded-md px-3 py-2 text-xs text-primary">
            Please configure LLM in Settings.
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="text-secondary hover:text-primary transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <LightIcon className="w-6 h-6" /> : <DarkIcon className="w-6 h-6" />}
        </button>
        <button
          type="button"
          onClick={onOpenConversations}
          aria-label="Conversations"
          className="text-secondary hover:text-primary transition-colors"
          ref={conversationsButtonRef}
        >
          <ConversationsIcon className="w-6 h-6" />
        </button>
        <button
          type="button"
          onClick={onNewConversation}
          aria-label="New conversation"
          className="text-secondary hover:text-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M11 13v3q0 .425.288.713T12 17t.713-.288T13 16v-3h3q.425 0 .713-.288T17 12t-.288-.712T16 11h-3V8q0-.425-.288-.712T12 7t-.712.288T11 8v3H8q-.425 0-.712.288T7 12t.288.713T8 13zm1 9q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Provider Settings"
          className="text-secondary hover:text-primary transition-colors"
        >
          <SettingsIcon className="w-6 h-6" />
        </button>
        <a
          href="https://github.com/elecmonkey/excali-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary hover:text-primary transition-colors"
          aria-label="View on GitHub"
        >
          <GitHubIcon className="w-6 h-6" width={24} height={24} />
        </a>
      </div>
    </div>
  );
}
