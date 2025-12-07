import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // Disable type checking during build
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
