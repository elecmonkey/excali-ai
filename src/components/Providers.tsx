"use client";

import { XProvider } from "@ant-design/x";
import { ConfigProvider } from "antd";
import { ExcalidrawProvider } from "@/lib/excalidraw-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#3b82f6",
          borderRadius: 8,
        },
      }}
    >
      <XProvider>
        <ExcalidrawProvider>{children}</ExcalidrawProvider>
      </XProvider>
    </ConfigProvider>
  );
}
