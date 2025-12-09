"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

// Excalidraw element type (simplified for our use case)
export type ExcalidrawElement = Record<string, unknown>;
export type BinaryFiles = Record<string, unknown>;

export interface ExcalidrawScene {
  elements: ExcalidrawElement[];
  files: BinaryFiles;
}

interface ExcalidrawContextType {
  // Current scene data
  scene: ExcalidrawScene;
  theme: "light" | "dark";
  
  // Update the scene (from AI tool results)
  updateScene: (elements: ExcalidrawElement[], files?: BinaryFiles) => void;
  
  // Clear the scene
  clearScene: () => void;

  // Toggle theme
  setTheme: (theme: "light" | "dark") => void;
  
  // Register the Excalidraw API for direct manipulation
  registerExcalidrawAPI: (api: ExcalidrawAPI) => void;
  
  // Get the current Excalidraw API
  getExcalidrawAPI: () => ExcalidrawAPI | null;
}

// Excalidraw API interface (subset of what we need)
export interface ExcalidrawAPI {
  updateScene: (scene: { elements: readonly ExcalidrawElement[]; files?: BinaryFiles }) => void;
  getSceneElements: () => readonly ExcalidrawElement[];
  getFiles: () => BinaryFiles;
  resetScene: () => void;
}

const ExcalidrawContext = createContext<ExcalidrawContextType | null>(null);

export function ExcalidrawProvider({ children }: { children: React.ReactNode }) {
  const [scene, setScene] = useState<ExcalidrawScene>({
    elements: [],
    files: {},
  });
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme");
    return stored === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  }, [theme]);
  const setTheme = useCallback((t: "light" | "dark") => setThemeState(t), []);
  
  const excalidrawAPIRef = useRef<ExcalidrawAPI | null>(null);
  
  const registerExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
    excalidrawAPIRef.current = api;
  }, []);
  
  const getExcalidrawAPI = useCallback(() => {
    return excalidrawAPIRef.current;
  }, []);
  
  const updateScene = useCallback((elements: ExcalidrawElement[], files?: BinaryFiles) => {
    const newScene = {
      elements,
      files: files || {},
    };
    setScene(newScene);
    
    // Also update Excalidraw directly if API is available
    if (excalidrawAPIRef.current) {
      excalidrawAPIRef.current.updateScene({
        elements: elements as readonly ExcalidrawElement[],
        files: files,
      });
    }
  }, []);
  
  const clearScene = useCallback(() => {
    setScene({ elements: [], files: {} });
    if (excalidrawAPIRef.current) {
      excalidrawAPIRef.current.resetScene();
    }
  }, []);
  
  return (
    <ExcalidrawContext.Provider
      value={{
        scene,
        theme,
        updateScene,
        clearScene,
        setTheme,
        registerExcalidrawAPI,
        getExcalidrawAPI,
      }}
    >
      {children}
    </ExcalidrawContext.Provider>
  );
}

export function useExcalidrawContext() {
  const context = useContext(ExcalidrawContext);
  if (!context) {
    throw new Error("useExcalidrawContext must be used within ExcalidrawProvider");
  }
  return context;
}
