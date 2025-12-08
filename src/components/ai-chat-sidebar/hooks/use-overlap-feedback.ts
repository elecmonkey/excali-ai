"use client";

import { useCallback, useEffect, useRef } from "react";
import { detectOverlaps } from "@/lib/geometry/overlap";

export function useOverlapFeedback(
  scene: { elements: any[] },
  sendMessage: (args: { text: string }) => Promise<void>,
  status: string
) {
  const lastOverlapHash = useRef<string>("");

  const hashScene = useCallback((elements: any[]) => {
    const sig = elements
      .map((el) => `${el.id || ""}:${el.versionNonce || el.version || ""}:${el.x}:${el.y}`)
      .sort()
      .join("|");
    return sig;
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const hash = hashScene(scene.elements as any[]);
    if (hash === lastOverlapHash.current) return;
    lastOverlapHash.current = hash;

    const overlaps = detectOverlaps(scene.elements as any[]);
    if (!overlaps.length) return;

    const lines = overlaps.map(
      (o) => `- a: ${o.a}, b: ${o.b}, ratio: ${o.overlapRatio.toFixed(2)}, area: ${o.overlapArea.toFixed(1)}`
    );
    void sendMessage({
      text:
        `[OVERLAP_FEEDBACK]\n` +
        `Detected overlaps. Please compute geometry and move nodes so shapes do not intersect (leave a gap); avoid repeating the same coordinates. If many overlaps remain, you may call the autoLayout tool (force-directed) to separate nodes, then fine-tune manually.\n` +
        `${lines.join("\n")}`,
    });
  }, [scene.elements, status, hashScene, sendMessage]);
}
