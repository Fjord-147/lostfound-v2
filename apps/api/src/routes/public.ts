// 公众端（无需登录，全部脱敏）：半盲列表 / 详情 / 马赛克照片 / 报失提交
import { Router } from "express";
import fs from "fs";
import { prisma } from "../lib/prisma";
import { sanitizeName, roughDate } from "../services/sanitize";
import { ensureBlurVersion } from "../services/mosaic";
import { CATEGORY_ICONS } from "../config";
import { audit } from "../middleware/audit";
import { ipRateLimit } from "../middleware/rateLimit";
import path from "path";
import { UPLOAD_DIR } from "../config";

const router = Router();
const PLACEHOLDER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// GET /api/public/items?category= —— 半盲卡片：马赛克标记+脱敏名+旬日期
router.get("/items", async (req, res) => {
  const category = ((req.query.category as string) || "").trim();
  const where: any = { status: "待认领" };
  if (category) where.category = category;
  const rows = await prisma.item.findMany({ where, orderBy: { id: "desc" } });
  const items = rows.map((r) => {
    const all = (r.photo || "").split(",").map((s) => s.trim()).filter(Boolean);
    const hidden = new Set((r.hiddenPhotos || "").split(",").map((s) => s.trim()).filter(Boolean));
    return {
      id: r.id,
      safeName: sanitizeName(r.name, r.category),
      category: r.category || "其他",
      icon: CATEGORY_ICONS[r.category || ""] || "📦",
      rough: roughDate(r.foundTime || (r.createdAt ? r.createdAt.toISOString() : "")),
      hasPhoto: all.some((p) => !hidden.has(p)),
    };
  });
  res.json({ ok: true, items });
});

// GET /api/public/item/:id —— 详情（脱敏）
router.get("/item/:id", async (req, res) => {
  const r = await prisma.item.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) return res.status(404).json({ ok: false, msg: "不存在" });
  res.json({
    ok: true,
    item: {
      id: r.id,
      safeName: sanitizeName(r.name, r.category),
      category: r.category || "其他",
      rough: roughDate(r.foundTime || (r.createdAt ? r.createdAt.toISOString() : "")),
      status: r.status,
    },
  });
});

// GET /api/public/photo/:id/:idx —— 马赛克照片（🔒隐藏的连马赛克都不给）
async function sendMosaic(req: any, res: any, idx: number) {
  const r = await prisma.item.findUnique({ where: { id: Number(req.params.id) } });
  if (!r) return placeholder(res);
  const all = (r.photo || "").split(",").map((s) => s.trim()).filter(Boolean);
  const hidden = new Set((r.hiddenPhotos || "").split(",").map((s) => s.trim()).filter(Boolean));
  const pub = all.filter((p) => !hidden.has(p));
  if (idx < 0 || idx >= pub.length) return placeholder(res);
  const file = await ensureBlurVersion(pub[idx]);
  if (!file || !fs.existsSync(file)) return placeholder(res);
  // 读成 Buffer 再发（res.sendFile 在部分环境有竞态/怪癖，曾致偶发500）
  const buf = fs.readFileSync(file);
  res.setHeader("Cache-Control", "no-cache");
  res.type("image/jpeg").send(buf);
}
router.get("/photo/:id/:idx", (req, res) => sendMosaic(req, res, Number(req.params.idx)));
router.get("/photo/:id", (req, res) => sendMosaic(req, res, 0)); // 兼容首图

function placeholder(res: any) {
  res.type("image/png").send(PLACEHOLDER);
}

// POST /api/public/report —— 公众报失（每IP每小时最多10条，防脚本刷库）
router.post("/report", ipRateLimit(60 * 60_000, 10), async (req, res) => {
  const b = req.body || {};
  const ownerName = String(b.ownerName || "").trim();
  const ownerPhone = String(b.ownerPhone || "").trim();
  const itemName = String(b.itemName || "").trim();
  if (!ownerName || !ownerPhone || !itemName) {
    return res.status(400).json({ ok: false, msg: "请填写姓名、电话、物品名称" });
  }
  const rep = await prisma.lostReport.create({
    data: {
      ownerName,
      ownerPhone,
      itemName,
      itemCategory: b.itemCategory || null,
      description: b.description || null,
      lostLocation: b.lostLocation === "__other__" ? b.lostLocationOther : b.lostLocation || null,
      lostTime: b.lostTime || null,
      photo: b.photo || null,
    },
  });
  await audit(req, "public_report", "lost_report", rep.id, { itemName, ownerName });
  res.json({ ok: true, msg: "报失成功！我们会尽快帮您留意，找到后请到门诊导医台核对认领。" });
});

export default router;
