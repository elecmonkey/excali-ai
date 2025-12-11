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
}

export function ChatHeader({ onOpenSettings, hasProvider, onOpenConversations, conversationsButtonRef }: ChatHeaderProps) {
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
