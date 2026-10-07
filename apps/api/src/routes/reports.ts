// 报失处理：列表 / 角标计数 / 登记入总表 / 已找到一步认领 / 撤销登记 / 忽略 / 重新查找
import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { createItemWithCodeRetry } from "../services/code";
import { UPLOAD_DIR, BLUR_DIR, HIGH_VALUE_CATEGORIES } from "../config";

const router = Router();
router.use(requireAuth);

function fmtNow() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function out(r: any) {
  return { ...r, createdAt: r.createdAt ? fmt(r.createdAt) : null };
}
function fmt(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// 防路径穿越的照片删除（与 items.ts 同规则）：仅允许纯文件名
function removePhotoFiles(filenames: (string | null | undefined)[]) {
  for (const fn of filenames) {
    if (!fn) continue;
    for (const one of String(fn).split(",")) {
      const t = one.trim();
      if (!t) continue;
      if (t.includes("/") || t.includes("\\") || t.includes("..")) continue;
      if (path.basename(t) !== t) continue;
      for (const dir of [UPLOAD_DIR, BLUR_DIR]) {
        try { fs.unlinkSync(path.join(dir, t)); } catch { /* 忽略不存在 */ }
      }
    }
  }
}

// 原子抢占一条待查找报失：并发处理只有一个线程能继续，失败者直接收到"已处理"。
// 先占位成功，后续失败再回滚状态（与 v1 的 UPDATE ... WHERE status='待查找' 对齐）。
async function preemptReport(id: number, placeholderStatus: "已登记" | "已找到", operator: string) {
  const r = await prisma.lostReport.updateMany({
    where: { id, status: "待查找" },
    data: { status: placeholderStatus, handledBy: operator, handledAt: fmtNow(), note: "处理中…" },
  });
  return r.count > 0;
}
async function rollbackReport(id: number, status: "已登记" | "已找到") {
  await prisma.lostReport.updateMany({
    where: { id, status },
    data: { status: "待查找", note: null },
  });
}

// GET /api/reports?status=&q= —— 列表（默认待查找）+ 各状态计数
router.get("/", async (req, res) => {
  const status = (req.query.status as string) || "待查找";
  const q = ((req.query.q as string) || "").trim();
  const where: any = {};
  if (status !== "all") where.status = status;
  if (q) {
    where.OR = ["ownerName", "ownerPhone", "itemName", "description"].map((f) => ({
      [f]: { contains: q },
    }));
  }
  const [reports, counts] = await Promise.all([
    prisma.lostReport.findMany({ where, orderBy: { id: "desc" } }),
    prisma.lostReport.groupBy({ by: ["status"], _count: true }),
  ]);
  const cnt: Record<string, number> = { 待查找: 0, 已登记: 0, 待领取: 0, 已找到: 0, 已忽略: 0 };
  for (const c of counts) cnt[c.status] = c._count;
  res.json({ ok: true, reports: reports.map(out), counts: cnt });
});

// GET /api/reports/pending-count —— 侧边栏角标
router.get("/pending-count", async (_req, res) => {
  const count = await prisma.lostReport.count({ where: { status: "待查找" } });
  res.json({ ok: true, count });
});

// POST /api/reports/:id/register —— 登记入失物总表（患者报失来源）
router.post("/:id/register", async (req, res) => {
  const id = Number(req.params.id);
  const rep = await prisma.lostReport.findUnique({ where: { id } });
  if (!rep) return res.status(404).json({ ok: false, msg: "报失记录不存在" });
  if (rep.status !== "待查找") return res.status(400).json({ ok: false, msg: "该报失已处理" });

  const me = req.authUser!;
  if (!(await preemptReport(id, "已登记", me.name))) {
    return res.status(400).json({ ok: false, msg: "该报失已处理" });
  }

  let item;
  try {
    // 编号撞 UNIQUE 自动换号重试
    item = await createItemWithCodeRetry((code) => ({
      code,
      name: rep.itemName,
      category: rep.itemCategory,
      description: rep.description,
      photo: rep.photo,
      foundLocation: rep.lostLocation,
      foundTime: rep.lostTime,
      founder: "患者报失",
      status: "待认领",
      source: "患者报失",
      registeredBy: me.name,
    }));
  } catch (e) {
    await rollbackReport(id, "已登记"); // 占位回滚：把报失还给待查找，方便重试
    throw e;
  }
  await prisma.lostReport.update({
    where: { id },
    data: {
      matchedItemId: item.id,
      note: (req.body?.note as string) || "已转入失物总表",
    },
  });
  await audit(req, "report_register", "lost_report", id, { code: item.code, itemId: item.id });
  res.json({ ok: true, msg: `已登记入失物总表，编号 ${item.code}（患者报失）`, itemId: item.id, code: item.code });
});

// POST /api/reports/:id/found-claim —— 已找到：登记+认领一步到位（含认领人照片）
router.post("/:id/found-claim", async (req, res) => {
  const id = Number(req.params.id);
  const rep = await prisma.lostReport.findUnique({ where: { id } });
  if (!rep) return res.status(404).json({ ok: false, msg: "报失记录不存在" });
  if (rep.status !== "待查找") return res.status(400).json({ ok: false, msg: "该报失已处理" });

  const b = req.body || {};
  const claimerName = String(b.claimerName || "").trim();
  if (!claimerName) return res.status(400).json({ ok: false, msg: "请填写认领人姓名" });
  if (!b.featureVerified) return res.status(400).json({ ok: false, msg: "请勾选已核对物品特征" });

  // 与 /api/items/:id/claim 同款的防冒领校验（严格模式）
  const claimerPhone = String(b.claimerPhone || "").trim();
  if (!/^1[3-9]\d{9}$/.test(claimerPhone)) {
    return res.status(400).json({ ok: false, msg: "请填写认领人11位手机号（仅收手机号码）" });
  }
  const claimerNote = String(b.claimerNote || "").trim();
  if (claimerNote.length < 10) {
    return res.status(400).json({ ok: false, msg: "请填写认领人自述特征（至少10个字），如物品颜色/品牌/内含物" });
  }
  if (HIGH_VALUE_CATEGORIES.includes(rep.itemCategory || "") && !b.claimerPhoto) {
    return res.status(400).json({ ok: false, msg: `「${rep.itemCategory}」类物品认领必须现场拍摄认领人照片` });
  }
  // 手机号一致性软拦截：报失一步认领默认回填报失手机号，不一致需勾选原因
  let mismatch: { reason: string; note?: string } | null = null;
  if (rep.ownerPhone !== claimerPhone) {
    const reason = String(b.claimMismatchReason || "").trim();
    const allowed = ["家属代领", "报失号码已换", "其他"];
    if (!allowed.includes(reason)) {
      return res.status(400).json({
        ok: false,
        msg: `认领手机号与报失手机号（${rep.ownerPhone}）不一致，请勾选原因（家属代领/报失号码已换/其他）后再提交`,
      });
    }
    const note = String(b.claimMismatchNote || "").trim();
    if (reason === "其他" && note.length < 2) {
      return res.status(400).json({ ok: false, msg: "选择「其他」时请填写具体说明" });
    }
    mismatch = { reason, note: note || undefined };
  }

  const me = req.authUser!;
  let claimedAt = fmtNow();
  if (b.claimedAt && String(b.claimedAt).includes("T")) {
    const t = String(b.claimedAt).replace("T", " ");
    const m = t.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if (m) claimedAt = `${m[1]} ${m[2]}:00`;
  }

  if (!(await preemptReport(id, "已找到", me.name))) {
    return res.status(400).json({ ok: false, msg: "该报失已处理" });
  }

  let item;
  try {
    item = await createItemWithCodeRetry((code) => ({
      code,
      name: rep.itemName,
      category: rep.itemCategory,
      description: rep.description,
      photo: rep.photo,
      foundLocation: rep.lostLocation,
      foundTime: rep.lostTime,
      founder: "患者报失",
      status: "已认领",
      source: "患者报失",
      registeredBy: me.name,
      claimerName,
      claimerPhone,
      claimerGroup: b.claimerGroup || null,
      claimerGender: b.claimerGender || null,
      featureVerified: true,
      claimedAt,
      operator: me.name,
      claimerPhoto: b.claimerPhoto || null,
      claimerNote,
    }));
  } catch (e) {
    await rollbackReport(id, "已找到");
    throw e;
  }
  await prisma.lostReport.update({
    where: { id },
    data: {
      matchedItemId: item.id,
      note: `已找到并认领，编号${item.code}`,
    },
  });
  await audit(req, "report_found_claim", "lost_report", id, { code: item.code, itemId: item.id, claimerName, claimerPhone, ...(mismatch ? { mismatch } : {}) });
  res.json({ ok: true, msg: `已找到并认领完成，编号 ${item.code}（患者报失）` });
});

// POST /api/reports/:id/undo-register —— 撤销登记（与 v1 对齐的闭环）：
// 把「登记入总表」回滚——关联物品仍在待认领才可撤销；物品删除、照片清理、报失回到待查找。
router.post("/:id/undo-register", async (req, res) => {
  const id = Number(req.params.id);
  const rep = await prisma.lostReport.findUnique({ where: { id } });
  if (!rep) return res.status(404).json({ ok: false, msg: "报失记录不存在" });
  if (rep.status !== "已登记" || !rep.matchedItemId) {
    return res.status(400).json({ ok: false, msg: "该报失没有可撤销的登记记录" });
  }
  const item = await prisma.item.findUnique({ where: { id: rep.matchedItemId } });
  if (!item) {
    // 物品已不在（可能已被单独删除）：直接把报失恢复到待查找
    await prisma.lostReport.update({
      where: { id },
      data: { status: "待查找", matchedItemId: null, note: "关联物品已不存在，恢复待查找" },
    });
    return res.status(400).json({ ok: false, msg: "关联的物品记录已不存在，报失已恢复待查找" });
  }
  if (item.status === "已认领") {
    return res.status(400).json({ ok: false, msg: "该物品已被认领，不能撤销登记" });
  }
  const me = req.authUser!;
  removePhotoFiles([item.photo, item.claimerPhoto]);
  await prisma.item.delete({ where: { id: item.id } });
  await prisma.lostReport.update({
    where: { id },
    data: {
      status: "待查找",
      matchedItemId: null,
      note: (req.body?.note as string) || "已撤销登记，重新查找",
      handledBy: me.name,
      handledAt: fmtNow(),
    },
  });
  await audit(req, "report_undo_register", "lost_report", id, { code: item.code, itemId: item.id });
  res.json({ ok: true, msg: `已撤销登记：${item.code} 已从总表移除，该报失重新进入待查找` });
});

// POST /api/reports/:id/confirm-found —— 已登记→待领取：
// 导医确认物品就是患者报的这件，患者查询页进度条跳到「已找到，请尽快来领」
router.post("/:id/confirm-found", async (req, res) => {
  const id = Number(req.params.id);
  const rep = await prisma.lostReport.findUnique({ where: { id } });
  if (!rep) return res.status(404).json({ ok: false, msg: "报失记录不存在" });
  if (rep.status !== "已登记") {
    return res.status(400).json({ ok: false, msg: "只有「已登记」状态的报失才能确认找到" });
  }
  const me = req.authUser!;
  const note = String(req.body?.note || "").trim() || "物品已找到，请尽快到门诊导医台核对认领";
  await prisma.lostReport.update({
    where: { id },
    data: { status: "待领取", note, handledBy: me.name, handledAt: fmtNow() },
  });
  await audit(req, "report_confirm_found", "lost_report", id, { note });
  res.json({ ok: true, msg: "已确认找到，患者查询页将显示「已找到，请尽快来领」" });
});

// POST /api/reports/:id/handle —— 忽略 / 重新查找
router.post("/:id/handle", async (req, res) => {
  const id = Number(req.params.id);
  const action = String(req.body?.action || "");
  const map: Record<string, string> = { ignore: "已忽略", reopen: "待查找" };
  const next = map[action];
  if (!next) return res.status(400).json({ ok: false, msg: "未知操作" });
  const rep = await prisma.lostReport.findUnique({ where: { id } });
  if (!rep) return res.status(404).json({ ok: false, msg: "报失记录不存在" });

  await prisma.lostReport.update({
    where: { id },
    data: {
      status: next,
      note: (req.body?.note as string) || rep.note,
      handledBy: req.authUser!.name,
      handledAt: fmtNow(),
    },
  });
  await audit(req, `report_${action}`, "lost_report", id, { from: rep.status, to: next });
  res.json({ ok: true, msg: `报失已更新为「${next}」` });
});

export default router;
