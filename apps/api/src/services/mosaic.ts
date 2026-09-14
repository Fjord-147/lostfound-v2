// 照片马赛克（sharp）：缩到 1/14 + 高斯模糊 + 放大回原尺寸
// 缓存到 uploads/blur/；原图仅管理端（登录后）可见
import path from "path";
import fs from "fs";
import sharp from "sharp";
import { BLUR_DIR, UPLOAD_DIR } from "../config";

export function blurFilePath(filename: string): string {
  const base = path.parse(path.basename(filename)).name;
  return path.join(BLUR_DIR, base + ".jpg");
}

export async function ensureBlurVersion(filename: string): Promise<string | null> {
  const dst = blurFilePath(filename);
  if (fs.existsSync(dst)) return dst;
  try {
    const src = path.join(UPLOAD_DIR, path.basename(filename));
    const img = sharp(src);
    const meta = await img.metadata();
    const w = Math.max(1, Math.floor((meta.width || 100) / 14));
    const h = Math.max(1, Math.floor((meta.height || 100) / 14));
    await sharp(src)
      .resize(w, h)
      .blur(1.5)
      .resize(meta.width || 100, meta.height || 100)
      .jpeg({ quality: 65 })
      .toFile(dst);
    return dst;
  } catch (e) {
    console.error("[mosaic] 生成失败:", filename, e);
    return null;
  }
}
