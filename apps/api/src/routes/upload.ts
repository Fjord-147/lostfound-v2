// 上传：物品多照片 / 认领人照片 / 公众报失照片
// 安全：扩展名白名单 + sharp 魔数内容校验（改名伪装绕不过）+ 体积/数量限制
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import express from "express";
import sharp from "sharp";
import { UPLOAD_DIR } from "../config";
import { requireAuth } from "../middleware/auth";
import { ipUploadQuota } from "../middleware/rateLimit";

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

/** multer 包装：把 LIMIT_* 错误转成友好 400，而不是 500 */
function pics(fieldName: string, max: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.array(fieldName, max)(req, res, (err: any) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ ok: false, msg: "单个文件超过16MB，请压缩或裁剪后重试" });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({ ok: false, msg: `一次最多上传 ${max} 张` });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({ ok: false, msg: "上传字段不正确" });
      }
      return res.status(400).json({ ok: false, msg: `上传失败：${err.message || "未知错误"}` });
    });
  };
}

/** 内容校验：sharp 能解析出图片元数据才算真图片；伪装文件删除并拒绝 */
async function verifyImages(files: Express.Multer.File[]): Promise<string | null> {
  for (const f of files) {
    try {
      const meta = await sharp(f.path).metadata();
      if (!meta.width || !meta.height) throw new Error("not image");
    } catch {
      try { fs.unlinkSync(f.path); } catch { /* 忽略 */ }
      return f.originalname;
    }
  }
  return null;
}

function respond(req: express.Request, res: express.Response) {
  (async () => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ ok: false, msg: "未收到有效图片（仅支持 jpg/png/gif/bmp/webp）" });
    }
    const fake = await verifyImages(files);
    if (fake) {
      return res.status(400).json({ ok: false, msg: `「${fake}」不是有效的图片文件` });
    }
    res.json({ ok: true, filenames: files.map((f) => f.filename) });
  })().catch((e) => {
    console.error("[upload]", e);
    res.status(500).json({ ok: false, msg: "上传处理失败" });
  });
}

// POST /api/upload/photo —— 管理（需登录）
router.post("/photo", requireAuth, pics("photo", 10), respond);

// POST /api/upload/public-photo —— 公众报失用（无需登录）
// 防匿名灌盘：单次≤3张 + 每IP每10分钟≤3张（超出429并丢弃本次文件）
router.post("/public-photo", pics("photo", 3), ipUploadQuota(10 * 60_000, 3), respond);

// 原图：仅登录后可见
router.use("/files", requireAuth, express.static(UPLOAD_DIR, { maxAge: 0 }));

export default router;
