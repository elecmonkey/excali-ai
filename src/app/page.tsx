"use client";

import dynamic from "next/dynamic";
import ResizableSplitPane from "@/components/ResizableSplitPane";
import AIChatSidebar from "@/components/AIChatSidebar";

// Dynamically import Excalidraw to avoid SSR issues
const ExcalidrawWrapper = dynamic(
  () => import("@/components/ExcalidrawWrapper"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-600 dark:text-zinc-400">Loading Excalidraw...</div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <ResizableSplitPane
      left={<ExcalidrawWrapper />}
      right={<AIChatSidebar />}
      defaultLeftWidth={70}
      minLeftWidth={50}
      minRightWidth={25}
    />
  );
}
