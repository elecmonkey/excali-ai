"use client";

import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";

export default function ExcalidrawWrapper() {
  return (
    <div className="h-full w-full">
      <Excalidraw
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
