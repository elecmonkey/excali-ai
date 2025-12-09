"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useExcalidrawContext } from "@/lib/excalidraw-context";
import { useCallback, useEffect, useRef } from "react";

export default function ExcalidrawWrapper() {
  const { registerExcalidrawAPI, theme, setTheme } = useExcalidrawContext();
  const lastAppliedTheme = useRef(theme);

  // Use any to bypass Excalidraw's complex type system
  const handleExcalidrawMount = useCallback((api: any) => {
    registerExcalidrawAPI(api);
  }, [registerExcalidrawAPI]);

  useEffect(() => {
    lastAppliedTheme.current = theme;
  }, [theme]);

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={handleExcalidrawMount}
        theme={theme}
        onChange={(_elements: any, appState: any) => {
          const nextTheme = appState?.theme;
          if (
            nextTheme &&
            (nextTheme === "light" || nextTheme === "dark") &&
            nextTheme !== lastAppliedTheme.current
          ) {
            lastAppliedTheme.current = nextTheme;
            setTheme(nextTheme);
          }
        }}
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
