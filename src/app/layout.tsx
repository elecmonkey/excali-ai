import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excalidraw AI Agent",
  description: "AI-powered diagram editor that lets users create and modify Excalidraw diagrams through natural language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script id="excalidraw-asset-path" strategy="beforeInteractive">
          {`window.EXCALIDRAW_ASSET_PATH = "https://esm.sh/@excalidraw/excalidraw@0.18.0/dist/prod/";`}
        </Script>
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
