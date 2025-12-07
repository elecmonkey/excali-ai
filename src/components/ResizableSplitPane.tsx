"use client";

import { useState, useRef, useEffect } from "react";

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number; // percentage (0-100)
  minLeftWidth?: number; // percentage
  minRightWidth?: number; // percentage
}

export default function ResizableSplitPane({
  left,
  right,
  defaultLeftWidth = 80,
  minLeftWidth = 30,
  minRightWidth = 15,
}: ResizableSplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Enforce min/max constraints
      if (newLeftWidth >= minLeftWidth && newLeftWidth <= 100 - minRightWidth) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, minLeftWidth, minRightWidth]);

  return (
    <div ref={containerRef} className="flex h-screen w-full overflow-hidden">
      {/* Left Pane */}
      <div style={{ width: `${leftWidth}%` }} className="h-full overflow-hidden">
        {left}
      </div>

      {/* Resizer */}
      <div
        onMouseDown={() => setIsDragging(true)}
        className={`w-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-blue-400 dark:hover:bg-blue-600 cursor-col-resize transition-colors ${
          isDragging ? "bg-blue-500 dark:bg-blue-500" : ""
        }`}
      />

      {/* Right Pane */}
      <div style={{ width: `${100 - leftWidth}%` }} className="h-full overflow-hidden">
        {right}
      </div>
    </div>
  );
}
