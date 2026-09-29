import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // monorepo：明确 workspace 根，消除推断警告
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // 生产构建固定为同源 API（经 nginx /api/ 反代）。
  // 不可依赖命令行传 NEXT_PUBLIC_* 或 .env.production——两者都曾实测未生效，
  // 漏配时前端会回退到 hostname:8000（8000 未对公网开放，页面报"网络异常"）。
  env: {
    NEXT_PUBLIC_API_SAME_ORIGIN: "1",
  },
};
export default nextConfig;
