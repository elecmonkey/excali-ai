"use client";

import { XProvider } from "@ant-design/x";
import { ConfigProvider, theme as antdTheme } from "antd";
import { ExcalidrawProvider } from "@/lib/excalidraw-context";
import { useExcalidrawContext } from "@/lib/excalidraw-context";

const PRIMARY_COLOR = "#3b82f6";

function ThemeBridge({ children }: { children: React.ReactNode }) {
  const { theme } = useExcalidrawContext();
  const isDark = theme === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: PRIMARY_COLOR, borderRadius: 8 },
      }}
    >
      <XProvider
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: { colorPrimary: PRIMARY_COLOR, borderRadius: 8 },
        }}
      >
        {children}
      </XProvider>
    </ConfigProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ExcalidrawProvider>
      <ThemeBridge>{children}</ThemeBridge>
    </ExcalidrawProvider>
  );
}
