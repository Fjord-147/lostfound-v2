// 上传：物品多照片 / 认领人照片（multer）+ 原图静态托管（需登录）
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import express from "express";
import { UPLOAD_DIR } from "../config";
import { requireAuth } from "../middleware/auth";

const ALLOWED = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.parse(file.originalname).ext.toLowerCase();
    const name = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 16 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.parse(file.originalname).ext.toLowerCase();
    cb(null, ALLOWED.has(ext));
  },
});

const router = Router();

// POST /api/upload/photo —— 单张（前端多张就多次调用，或 photo 字段数组）
router.post("/photo", requireAuth, upload.array("photo", 10), (req, res) => {
  const files = (req.files as Express.Multer.File[]) || [];
  res.json({ ok: true, filenames: files.map((f) => f.filename) });
});

// 原图：仅登录后可见
router.use("/files", requireAuth, express.static(UPLOAD_DIR, { maxAge: 0 }));

export default router;
