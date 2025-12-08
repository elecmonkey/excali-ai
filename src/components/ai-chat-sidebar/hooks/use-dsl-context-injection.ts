"use client";

import { useCallback } from "react";
import { readScene } from "@/lib/client-tools/scene-utils";
import { serializeDSL } from "@/lib/dsl/serializer";
import { jsonToDsl } from "@/lib/dsl/json-mapper";

export function useDslContextInjection(
  canvasOps: () => { clearScene: any; updateScene: any; getExcalidrawAPI: any }
) {
  const displayText = useCallback((text: string) => {
    const marker = "\n\n[CURRENT_DIAGRAM_DSL]";
    const idx = text.indexOf(marker);
    return idx === -1 ? text : text.slice(0, idx);
  }, []);

  const extractDsl = useCallback((text: string) => {
    const marker = "\n\n[CURRENT_DIAGRAM_DSL]";
    const idx = text.indexOf(marker);
    return idx === -1 ? "" : text.slice(idx + marker.length).trim();
  }, []);

  const buildMessageWithContext = useCallback(
    (message: string) => {
      const { elements, files } = readScene(canvasOps());
      const dsl = serializeDSL(jsonToDsl({ elements: elements as any, files, appState: {} }));
      return `${message}\n\n[CURRENT_DIAGRAM_DSL]\n${dsl}`;
    },
    [canvasOps]
  );

  return { displayText, extractDsl, buildMessageWithContext };
}
