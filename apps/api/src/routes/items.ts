// 失物核心路由：登记 / 列表 / 详情 / 编辑 / 认领 / 撤销 / 删除 / 捡到人
import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { generateItemCode } from "../services/code";
import { normDate } from "../services/sanitize";
import { UPLOAD_DIR, BLUR_DIR } from "../config";

const router = Router();
router.use(requireAuth);

// createdAt(DateTime) → "YYYY-MM-DD HH:mm:ss"（与 v1 显示习惯一致）
function fmt(d: Date | null): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function out(item: any) {
  return { ...item, createdAt: fmt(item.createdAt) };
}

function parseClaimTime(raw: string | undefined): string {
  if (raw && raw.trim()) {
    const t = raw.trim().replace("T", "");
    const m = t.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if (m) return `${m[1]} ${m[2]}:00`;
  }
  const now = new Date();
  return fmt(now)!;
}

function removePhotoFiles(filenames: (string | null | undefined)[]) {
  for (const fn of filenames) {
    if (!fn) continue;
    for (const one of String(fn).split(",")) {
      const t = one.trim();
      if (!t) continue;
      for (const dir of [UPLOAD_DIR, BLUR_DIR]) {
        try { fs.unlinkSync(path.join(dir, t)); } catch { /* 忽略不存在 */ }
      }
    }
  }
}

// ===== POST /api/items —— 拾物登记 =====
router.post("/", async (req, res: Response) => {
  const b = req.body || {};
  const name = String(b.name || "").trim();
  const storageLocation = String(b.storageLocation || "").trim();
  if (!name) return res.status(400).json({ ok: false, msg: "请填写物品名称" });
  if (!storageLocation) return res.status(400).json({ ok: false, msg: "请填写存放位置，方便后续取物" });

  const me = req.authUser!;
  const code = await generateItemCode();
  const photoArr: string[] = Array.isArray(b.photos) ? b.photos.filter(Boolean) : [];
  const hiddenArr: string[] = Array.isArray(b.hiddenPhotos) ? b.hiddenPhotos.filter(Boolean) : [];

  const item = await prisma.item.create({
    data: {
      code,
      name,
      category: b.category || null,
      description: b.description || null,
      photo: photoArr.length ? photoArr.join(",") : null,
      foundLocation: b.foundLocation || null,
      foundTime: b.foundTime || null,
      founder: b.founder || me.name,
      storageLocation,
      hiddenPhotos: hiddenArr.length ? hiddenArr.join(",") : null,
      source: b.source || null, // "患者报失" 由报失转入时传
      registeredBy: b.registeredBy || me.name,
    },
  });
  await audit(req, "register", "item", item.id, { code, name, storageLocation });
  res.json({ ok: true, item: out(item) });
});

// ===== GET /api/items?status=&q=&dateFrom=&dateTo=&view=all|pending|claims =====
router.get("/", async (req, res) => {
  const status = (req.query.status as string) || "待认领";
  const q = ((req.query.q as string) || "").trim();
  const dateFrom = normDate((req.query.dateFrom as string) || "");
  const dateTo = normDate((req.query.dateTo as string) || "");
  const view = (req.query.view as string) || "";

  const where: any = {};
  if (view === "claims") {
    where.status = "已认领";
    if (q) {
      where.OR = ["code", "name", "description", "claimerName", "claimerPhone"].map((f) => ({
        [f]: { contains: q },
      }));
    }
  } else {
    if (status === "待认领" || status === "已认领") where.status = status;
    if (q) {
      where.OR = ["code", "name", "category", "description"].map((f) => ({
        [f]: { contains: q },
      }));
    }
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59");
  }

  const items = await prisma.item.findMany({ where, orderBy: { id: "desc" }, take: 500 });
  res.json({ ok: true, items: items.map(out) });
});

// ===== GET /api/items/pending —— 工作台：统计 + 待认领清单 =====
router.get("/pending", async (req, res) => {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  const month = today.slice(0, 7);

  const [todayCount, pendingCount, monthReturned, pendingReports, pendingItems] =
    await Promise.all([
      prisma.item.count({ where: { createdAt: { gte: new Date(today + "T00:00:00") } } }),
      prisma.item.count({ where: { status: "待认领" } }),
      prisma.item.count({
        where: { status: "已认领", claimedAt: { startsWith: month } },
      }),
      prisma.lostReport.count({ where: { status: "待查找" } }),
      prisma.item.findMany({
        where: { status: "待认领" },
        orderBy: { id: "desc" },
        take: 10,
      }),
    ]);
  res.json({
    ok: true,
    stats: { todayCount, pendingCount, monthReturned, pendingReports },
    items: pendingItems.map(out),
  });
});

// ===== GET /api/items/:id —— 详情 =====
router.get("/:id", async (req, res) => {
  const item = await prisma.item.findUnique({ where: { id: Number(req.params.id) } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  res.json({ ok: true, item: out(item) });
});

// ===== PUT /api/items/:id —— 编辑物品信息（编号/照片不变）=====
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, msg: "物品名称不能为空" });

  const updated = await prisma.item.update({
    where: { id },
    data: {
      name,
      category: b.category ?? item.category,
      description: b.description ?? item.description,
      foundLocation: b.foundLocation ?? item.foundLocation,
      foundTime: b.foundTime ?? item.foundTime,
      storageLocation: b.storageLocation ?? item.storageLocation,
      // 患者报失的捡到人锁定
      founder:
        item.source === "患者报失" ? "患者报失" : (b.founder ?? item.founder),
    },
  });
  await audit(req, "edit", "item", id, { before: { name: item.name }, after: { name } });
  res.json({ ok: true, item: out(updated), msg: `物品信息已更新（${item.code}）` });
});

// ===== PUT /api/items/:id/founder —— 表格内联改捡到人 =====
router.put("/:id/founder", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  if (item.source === "患者报失") {
    return res.status(400).json({ ok: false, msg: "患者报失的捡到人不可修改" });
  }
  await prisma.item.update({
    where: { id },
    data: { founder: String(req.body?.founder || "").trim() || null },
  });
  await audit(req, "edit_founder", "item", id, { founder: req.body?.founder });
  res.json({ ok: true, msg: "捡到人已更新" });
});

// ===== POST /api/items/:id/claim —— 认领（keepClaim=true 时为修改认领信息）=====
router.post("/:id/claim", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  const keep = !!(req.body as any)?.keepClaim;
  if (item.status === "已认领" && !keep) {
    return res.status(400).json({ ok: false, msg: "该物品已被认领" });
  }

  const b = req.body || {};
  const claimerName = String(b.claimerName || "").trim();
  if (!claimerName) return res.status(400).json({ ok: false, msg: "请填写认领人姓名" });
  if (!b.featureVerified) return res.status(400).json({ ok: false, msg: "请勾选已核对物品特征" });

  const me = req.authUser!;
  const claimedAt = keep ? (item.claimedAt || parseClaimTime(b.claimedAt)) : parseClaimTime(b.claimedAt);
  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: "已认领",
      claimerName,
      claimerPhone: String(b.claimerPhone || "").trim() || null,
      claimerGroup: b.claimerGroup || null,
      claimerGender: b.claimerGender || null,
      featureVerified: true,
      claimedAt,
      operator: me.name,
      ...(keep ? {} : { claimerPhoto: b.claimerPhoto || null }),
    },
  });
  await audit(req, keep ? "edit_claim" : "claim", "item", id, { code: item.code, claimerName, claimedAt });
  res.json({
    ok: true, item: out(updated),
    msg: keep ? "认领信息已更新" : `认领登记完成：${item.code} 已归还给 ${claimerName}`,
  });
});

// ===== POST /api/items/:id/unclaim —— 撤销认领（需输"确认"）=====
router.post("/:id/unclaim", async (req, res) => {
  const id = Number(req.params.id);
  if (String(req.body?.confirm || "").trim() !== "确认") {
    return res.status(400).json({ ok: false, msg: "请输入“确认”二字以执行撤销" });
  }
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  const updated = await prisma.item.update({
    where: { id },
    data: {
      status: "待认领",
      claimerName: null, claimerPhone: null, claimerGroup: null, claimerGender: null,
      claimedAt: null, operator: null, featureVerified: false, claimerPhoto: null,
    },
  });
  removePhotoFiles([item.claimerPhoto]);
  await audit(req, "unclaim", "item", id, { code: item.code, formerClaimer: item.claimerName });
  res.json({ ok: true, msg: `已撤销认领：${item.code} 退回待认领` });
});

// ===== POST /api/items/:id/delete —— 删除整条（需输"确认"，含照片）=====
router.post("/:id/delete", async (req, res) => {
  const id = Number(req.params.id);
  if (String(req.body?.confirm || "").trim() !== "确认") {
    return res.status(400).json({ ok: false, msg: "请输入“确认”二字以执行删除" });
  }
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  removePhotoFiles([item.photo, item.claimerPhoto]);
  await prisma.item.delete({ where: { id } });
  await audit(req, "delete", "item", id, { code: item.code, name: item.name });
  res.json({ ok: true, msg: `已删除记录：${item.code} ${item.name}` });
});

export default router;
