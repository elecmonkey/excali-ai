"use client";

import { XProvider } from "@ant-design/x";
import { ConfigProvider } from "antd";

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
      <XProvider>{children}</XProvider>
    </ConfigProvider>
  );
}
