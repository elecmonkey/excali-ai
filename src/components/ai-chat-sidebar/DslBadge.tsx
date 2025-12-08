"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface DslBadgeProps {
  dsl: string;
}

export function DslBadge({ dsl }: DslBadgeProps) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
      }
    };
  }, []);

  const onEnter = () => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.top, left: rect.left });
    }
    setVisible(true);
  };

  const onLeave = () => {
    hideTimer.current = window.setTimeout(() => setVisible(false), 500);
  };

  return (
    <div className="relative flex items-start">
      <button
        aria-label="Show DSL snapshot"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        ref={btnRef}
        className="h-4 w-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[9px] flex items-center justify-center border border-zinc-200 dark:border-zinc-700 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-200"
      >
        D
      </button>
      {pos &&
        createPortal(
          <div
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            className={`fixed bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg max-h-64 w-72 overflow-auto p-3 text-xs whitespace-pre-wrap z-9999 transition-opacity duration-200 ${
              visible ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
            style={{
              top: pos.top,
              left: pos.left,
              transform: "translate(-100%, 0)",
            }}
          >
            {dsl}
          </div>,
          document.body
        )}
    </div>
  );
}
