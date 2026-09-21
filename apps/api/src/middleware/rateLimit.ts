// 轻量内存限流（单机够用，无需 Redis）
// 按 IP 统计上传文件数：每 windowMs 毫秒最多 maxFiles 张（公众匿名接口防存储型 DoS）
import { Request, Response, NextFunction } from "express";

interface Bucket {
  count: number;
  resetAt: number;
}
const buckets = new Map<string, Bucket>();

// 惰性清理过期桶，防内存无限增长
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [ip, b] of buckets) {
    if (now > b.resetAt) buckets.delete(ip);
  }
}

/** 用法：挂在 multer 之后（此时 req.files 已解析），按本次文件数累计 */
export function ipUploadQuota(windowMs = 10 * 60_000, maxFiles = 3) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    sweep(now);
    const ip = (req as any).clientIp || req.ip || req.socket.remoteAddress || "unknown";
    let b = buckets.get(ip);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, b);
    }
    const incoming = ((req.files as Express.Multer.File[]) || []).length;
    if (b.count + incoming > maxFiles) {
      // 本次文件直接丢弃
      for (const f of (req.files as Express.Multer.File[]) || []) {
        try { require("fs").unlinkSync(f.path); } catch { /* 忽略 */ }
      }
      const waitMin = Math.max(1, Math.ceil((b.resetAt - now) / 60_000));
      return res.status(429).json({
        ok: false,
        msg: `上传数量超出限制（每${Math.round(windowMs / 60000)}分钟最多${maxFiles}张），请${waitMin}分钟后再试`,
      });
    }
    b.count += incoming;
    next();
  };
}

/** 按请求数限流（防脚本刷表单）：每 windowMs 最多 max 次 */
export function ipRateLimit(windowMs = 3600_000, max = 10) {
  const local = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const ip = (req as any).clientIp || req.ip || req.socket.remoteAddress || "unknown";
    let b = local.get(ip);
    if (!b || now > b.resetAt) {
      b = { count: 0, resetAt: now + windowMs };
      local.set(ip, b);
    }
    if (b.count + 1 > max) {
      const waitMin = Math.max(1, Math.ceil((b.resetAt - now) / 60_000));
      return res.status(429).json({
        ok: false,
        msg: `提交过于频繁（每${Math.round(windowMs / 60000)}分钟最多${max}条），请${waitMin}分钟后再试`,
      });
    }
    b.count += 1;
    next();
  };
}
