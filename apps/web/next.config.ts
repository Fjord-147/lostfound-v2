import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // monorepo：明确 workspace 根，消除推断警告
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
