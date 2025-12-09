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
        className="h-4 w-4 rounded-full bg-muted text-secondary text-[9px] flex items-center justify-center border border-muted hover:bg-blue-100 hover:text-blue-700"
      >
        D
      </button>
      {pos &&
        createPortal(
          <div
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            className={`fixed bg-surface text-primary border border-muted rounded-lg shadow-lg max-h-64 w-72 overflow-auto p-3 text-xs whitespace-pre-wrap z-[9999] transition-opacity duration-200 ${
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
