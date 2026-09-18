// 苏州和康中医医院 失物招领系统 v2 —— API 入口
import express from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import cors from "cors";
import { UPLOAD_DIR, ensureUploadDirs } from "./config";
import authRoutes from "./routes/auth";
import itemRoutes from "./routes/items";
import reportRoutes from "./routes/reports";
import publicRoutes from "./routes/public";
import statsRoutes from "./routes/stats";
import uploadRoutes from "./routes/upload";
import { errorHandler } from "./middleware/errorHandler";

ensureUploadDirs();

const app = express();
// 跨域白名单：只允许生产域名与本地开发地址携带cookie跨域调接口。
// 其他来源（含任意恶意网站）不回显许可头，浏览器同源策略自动拦截其带凭证请求。
const CORS_ALLOW = new Set([
  "http://47.103.214.67:8082",   // 生产（同源部署，正常使用不触发跨域）
  "http://localhost:3000",        // 本地开发
  "http://127.0.0.1:3000",        // 本地开发
]);
const corsOptions = {
  origin: (origin: string | undefined, cb: (err: Error | null, ok?: boolean) => void) => {
    // 无 Origin（同源请求/curl/服务器间调用）直接放行
    if (!origin || CORS_ALLOW.has(origin)) return cb(null, true);
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());

// 健康检查（标准要求）
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "lostfound-api", time: new Date().toISOString() });
});

// 路由
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/public", publicRoutes); // 公众端（无需登录，脱敏）
app.use("/api/stats", statsRoutes);
app.use("/api/upload", uploadRoutes);

// 原图：需登录（auth 中间件在 upload 路由内处理静态托管）
// 公众马赛克：/api/public/photo/:id/:idx 在 publicRoutes 内

app.use(errorHandler);

const PORT = parseInt(process.env.API_PORT || "8000", 10);
app.listen(PORT, () => {
  console.log(`[lostfound-api] listening on :${PORT}`);
});
