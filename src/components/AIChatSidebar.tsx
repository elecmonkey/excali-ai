"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";

export default function AIChatSidebar() {
  const { messages, sendMessage } = useChat();
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    
    sendMessage({ text: input });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Assistant</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Ask me to help with your diagram</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-2 ${
                msg.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {msg.parts.map((part, idx) => {
                if (part.type === "text") {
                  return (
                    <p key={idx} className="text-sm whitespace-pre-wrap">
                      {part.text}
                    </p>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 text-sm border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSend}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
