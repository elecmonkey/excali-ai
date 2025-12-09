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
  const loadSaved = () => {
    if (typeof window === "undefined") return null;
    const saved = localStorage.getItem("split-position");
    if (!saved) return null;
    try {
      return JSON.parse(saved) as { horizontal?: number; vertical?: number };
    } catch {
      return null;
    }
  };
  const saved = loadSaved();
  const [leftWidth, setLeftWidth] = useState(saved?.horizontal ?? defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVertical, setIsVertical] = useState(false);
  const [verticalDefault] = useState(saved?.vertical ?? 60); // percent for top pane on mobile

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const updateLayout = () => {
      setIsVertical(mq.matches);
      if (mq.matches) {
        setLeftWidth(verticalDefault);
      }
    };
    updateLayout();
    mq.addEventListener("change", updateLayout);
    return () => mq.removeEventListener("change", updateLayout);
  }, [verticalDefault]);

  useEffect(() => {
    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      if (isVertical) {
        const newTopHeight = ((clientY - containerRect.top) / containerRect.height) * 100;
        if (newTopHeight >= 5 && newTopHeight <= 95) {
          setLeftWidth(newTopHeight);
          localStorage.setItem(
            "split-position",
            JSON.stringify({ horizontal: leftWidth, vertical: newTopHeight })
          );
        }
        return;
      }

      const newLeftWidth = ((clientX - containerRect.left) / containerRect.width) * 100;

      // Enforce min/max constraints
      if (newLeftWidth >= minLeftWidth && newLeftWidth <= 100 - minRightWidth) {
        setLeftWidth(newLeftWidth);
        localStorage.setItem(
          "split-position",
          JSON.stringify({ horizontal: newLeftWidth, vertical: leftWidth })
        );
      }
    };

    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) {
        e.preventDefault();
        handlePointerMove(t.clientX, t.clientY);
      }
    };
    const onPointerUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", onMouseMove, { passive: true });
      document.addEventListener("mouseup", onPointerUp);
      document.addEventListener("touchmove", onTouchMove, { passive: false });
      document.addEventListener("touchend", onPointerUp);
      document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      document.body.style.touchAction = "none";
    }

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onPointerUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
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
        onTouchStart={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        className={`${
          isVertical
            ? "h-3 w-full cursor-row-resize"
            : "w-3 h-full cursor-col-resize"
        } flex items-center justify-center transition-colors touch-none`}
      >
        <div
          className={`${
            isVertical ? "h-1 w-full" : "w-1 h-full"
          } bg-divider hover:bg-blue-400 transition-colors ${isDragging ? "bg-blue-500" : ""}`}
        />
      </div>

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
