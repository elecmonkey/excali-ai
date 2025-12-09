"use client";

import { FormEvent } from "react";

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: FormEvent) => void;
  onStop: () => void;
}

export function ChatInput({
  inputValue,
  setInputValue,
  isLoading,
  onSubmit,
  onStop,
}: ChatInputProps) {
  return (
    <form onSubmit={onSubmit} className="p-4 border-t border-muted bg-surface">
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Describe the diagram you want..."
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-sm border border-muted rounded-lg bg-surface text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
          <button
            type="button"
            onClick={onStop}
            disabled={!isLoading}
            className="px-3 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Stop output"
          >
            ✕
          </button>
        </div>
      </div>
    </form>
  );
}
