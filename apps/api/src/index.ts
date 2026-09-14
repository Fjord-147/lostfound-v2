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
// 跨域：前后端分离（web:3000 → api:8000），反射Origin并允许cookie
app.use(cors({ origin: true, credentials: true }));
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
