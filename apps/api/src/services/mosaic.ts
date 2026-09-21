// 照片马赛克（sharp）：缩到 1/14 + 模糊 + 邻近采样放大
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
    const meta = await sharp(src).metadata();
    const W = meta.width || 100;
    const H = meta.height || 100;
    // 两段管道生成真马赛克（链式 resize 会相互覆盖，不能一步到位）
    const small = await sharp(src)
      .resize(Math.max(1, Math.floor(W / 14)), Math.max(1, Math.floor(H / 14)))
      .blur(1.2)
      .toBuffer();
    const out = await sharp(small)
      .resize(W, H, { kernel: "nearest" })
      .jpeg({ quality: 60 })
      .toBuffer();
    // 自写文件（避免 toFile 在部分环境下静默写出原图的怪癖），写后回读校验尺寸
    fs.writeFileSync(dst, out);
    const verify = await sharp(dst).metadata();
    if (verify.width !== W || verify.height !== H) {
      // 保险：产物尺寸异常（如坏 sharp 不变换）则视为失败 → 占位图
      try { fs.unlinkSync(dst); } catch { /* 忽略 */ }
      return null;
    }
    return dst;
  } catch (e) {
    console.error("[mosaic] 生成失败:", filename, e);
    return null;
  }
}
