"use client";

import { useState, useRef, useEffect } from "react";

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number; // percentage (0-100) for desktop (xl+)
  minLeftWidth?: number; // percentage for desktop
  minRightWidth?: number; // percentage for desktop
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
  const [isVertical, setIsVertical] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const updateLayout = () => setIsVertical(mq.matches);
    updateLayout();
    mq.addEventListener("change", updateLayout);
    return () => mq.removeEventListener("change", updateLayout);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      if (isVertical) {
        const newTopHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        if (newTopHeight >= 5 && newTopHeight <= 95) {
          setLeftWidth(newTopHeight);
        }
        return;
      }

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
      document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, isVertical, minLeftWidth, minRightWidth]);

  return (
    <div
      ref={containerRef}
      className={`h-screen w-full overflow-hidden ${isVertical ? "flex flex-col" : "flex"}`}
    >
      {/* Left/Top Pane */}
      <div
        style={
          isVertical
            ? { height: `${leftWidth}%`, minHeight: "5%" }
            : { width: `${leftWidth}%`, minWidth: `${minLeftWidth}%` }
        }
        className="overflow-hidden"
      >
        {left}
      </div>

      {/* Resizer */}
      <div
        onMouseDown={() => setIsDragging(true)}
        className={`${
          isVertical ? "h-1 w-full cursor-row-resize" : "w-1 h-full cursor-col-resize"
        } bg-divider hover:bg-blue-400 transition-colors ${isDragging ? "bg-blue-500" : ""}`}
      />

      {/* Right/Bottom Pane */}
      <div
        style={
          isVertical
            ? { height: `${100 - leftWidth}%`, minHeight: "5%" }
            : { width: `${100 - leftWidth}%`, minWidth: `${minRightWidth}%` }
        }
        className="overflow-hidden"
      >
        {right}
      </div>
    </div>
  );
}
