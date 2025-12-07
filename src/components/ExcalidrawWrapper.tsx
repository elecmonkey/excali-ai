"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useExcalidrawContext } from "@/lib/excalidraw-context";
import { useCallback } from "react";

export default function ExcalidrawWrapper() {
  const { registerExcalidrawAPI } = useExcalidrawContext();
  
  // Use any to bypass Excalidraw's complex type system
  const handleExcalidrawMount = useCallback((api: any) => {
    registerExcalidrawAPI(api);
  }, [registerExcalidrawAPI]);

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={handleExcalidrawMount}
        theme="light"
        UIOptions={{
          canvasActions: {
            saveToActiveFile: true,
            loadScene: true,
            export: { saveFileToDisk: true },
            toggleTheme: true,
          },
        }}
      />
    </div>
  );
}
