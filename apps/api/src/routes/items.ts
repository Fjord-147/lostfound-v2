// 失物核心路由：登记 / 列表 / 详情 / 编辑 / 认领 / 撤销 / 删除 / 捡到人
import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { createItemWithCodeRetry } from "../services/code";
import { normDate } from "../services/sanitize";
import { UPLOAD_DIR, BLUR_DIR, HIGH_VALUE_CATEGORIES } from "../config";

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
      // 防路径穿越：仅允许"纯文件名"（无目录、无..），杜绝 ../../ 任意文件删除
      if (t.includes("/") || t.includes("\\") || t.includes("..")) continue;
      if (path.basename(t) !== t) continue;
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
  // A. 特征描述内部登记选填（患者报失必填，见 public.ts）；
  // 填了就要求 ≥5 字，保证写就有核对价值
  const description = String(b.description || "").trim();
  if (description && description.length < 5) {
    return res.status(400).json({ ok: false, msg: "特征描述至少5个字，请写具体（颜色/品牌/内含物）" });
  }

  const me = req.authUser!;
  const photoArr: string[] = Array.isArray(b.photos) ? b.photos.filter(Boolean) : [];
  const hiddenArr: string[] = Array.isArray(b.hiddenPhotos) ? b.hiddenPhotos.filter(Boolean) : [];

  // 编号有并发竞争，撞 UNIQUE 自动换号重试（见 createItemWithCodeRetry）
  const item = await createItemWithCodeRetry((code) => ({
    code,
    name,
    category: b.category || null,
    description: description || null,
    photo: photoArr.length ? photoArr.join(",") : null,
    foundLocation: b.foundLocation || null,
    foundTime: b.foundTime || null,
    founder: b.founder || me.name,
    storageLocation,
    hiddenPhotos: hiddenArr.length ? hiddenArr.join(",") : null,
    source: b.source || null, // "患者报失" 由报失转入时传
    registeredBy: b.registeredBy || me.name,
  }));
  await audit(req, "register", "item", item.id, { code: item.code, name, storageLocation });
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
  // 日期筛选：认领视图按「认领时间」筛（本月已归还），其余按登记时间筛
  if (dateFrom || dateTo) {
    const field = view === "claims" ? "claimedAt" : "createdAt";
    where[field] = {};
    if (dateFrom) where[field].gte = view === "claims" ? dateFrom : new Date(dateFrom + "T00:00:00");
    if (dateTo) where[field].lte = view === "claims" ? dateTo + " 23:59:59" : new Date(dateTo + "T23:59:59");
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

  const [todayCount, pendingCount, monthReturned, todayReturned, pendingReports, pendingItems] =
    await Promise.all([
      // 今日新登记口径：今天登记且仍在库（待认领）——当天已归还的只计入"今日归还"，避免双份
      prisma.item.count({ where: { createdAt: { gte: new Date(today + "T00:00:00") }, status: "待认领" } }),
      prisma.item.count({ where: { status: "待认领" } }),
      prisma.item.count({
        where: { status: "已认领", claimedAt: { startsWith: month } },
      }),
      prisma.item.count({
        where: { status: "已认领", claimedAt: { startsWith: today } },
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
    stats: { todayCount, pendingCount, monthReturned, todayReturned, pendingReports },
    items: pendingItems.map(out),
  });
});

// ===== GET /api/items/:id —— 详情 =====
router.get("/:id", async (req, res) => {
  const idNum = Number(req.params.id);
  if (!Number.isInteger(idNum)) return res.status(400).json({ ok: false, msg: "无效的物品ID" });
  const item = await prisma.item.findUnique({ where: { id: idNum } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  // 患者报失来源：附带报失手机号，前端据此做"认领号码一致性"软拦截提示
  let reportPhone: string | null = null;
  if (item.source === "患者报失") {
    const rep = await prisma.lostReport.findFirst({
      where: { matchedItemId: item.id },
      select: { ownerPhone: true },
    });
    reportPhone = rep?.ownerPhone || null;
  }
  res.json({ ok: true, item: out(item), reportPhone });
});

// ===== PUT /api/items/:id —— 编辑物品信息（编号/照片不变）=====
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  const b = req.body || {};
  const name = String(b.name || "").trim();
  if (!name) return res.status(400).json({ ok: false, msg: "物品名称不能为空" });

  // 照片可见性：hiddenPhotos 只接受「该物品已有照片」的子集（与 v1 对齐），
  // 防止传不属于该物品的文件名
  let hiddenPhotos: string | null | undefined;
  if (b.hiddenPhotos !== undefined) {
    const all = new Set(
      (item.photo || "").split(",").map((s) => s.trim()).filter(Boolean)
    );
    const hid = String(b.hiddenPhotos || "").split(",").map((s) => s.trim()).filter(Boolean);
    const invalid = hid.filter((h) => !all.has(h));
    if (invalid.length) {
      return res.status(400).json({ ok: false, msg: "包含不属于该物品的照片，已拒绝保存" });
    }
    hiddenPhotos = hid.length ? hid.join(",") : null;
  }

  // 特征描述：传了非空值就校验长度（补录老物品时同样≥5字）
  if (b.description !== undefined && String(b.description).trim() && String(b.description).trim().length < 5) {
    return res.status(400).json({ ok: false, msg: "特征描述至少5个字，请写具体（颜色/品牌/内含物）" });
  }

  const updated = await prisma.item.update({
    where: { id },
    data: {
      name,
      category: b.category ?? item.category,
      description: b.description !== undefined ? String(b.description).trim() || null : item.description,
      foundLocation: b.foundLocation ?? item.foundLocation,
      foundTime: b.foundTime ?? item.foundTime,
      storageLocation: b.storageLocation ?? item.storageLocation,
      // 患者报失的捡到人锁定
      founder:
        item.source === "患者报失" ? "患者报失" : (b.founder ?? item.founder),
      // 照片可见性可事后修改：不传=保持原值，校验过的子集=隐藏指定照片，空串=全部公开
      hiddenPhotos: hiddenPhotos !== undefined ? hiddenPhotos : item.hiddenPhotos,
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
// 防冒领四道校验（新认领严格模式；编辑历史认领宽松模式）：
//  D. 认领人电话必填且仅收 11 位手机号；高价值类别（证件/手机数码/钱包）必须现场拍照
//  B. 认领人自述特征 ≥10 字（留痕，导医对照登记特征核对）——但患者报失来源豁免：
//     认领前已留过报失描述，原话即有效自述，不作字数限制
//  C. 患者报失来源：认领手机号≠报失手机号 → 软拦截，需勾选原因（家属代领/号码已换/其他）
//  A. 可顺带补录登记特征（老物品无描述时认领抽屉提供补录框）
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

  const claimerPhone = String(b.claimerPhone || "").trim();
  const claimerNote = String(b.claimerNote || "").trim();
  if (!keep) {
    // 严格模式（新认领）
    if (!/^1[3-9]\d{9}$/.test(claimerPhone)) {
      return res.status(400).json({ ok: false, msg: "请填写认领人11位手机号（仅收手机号码）" });
    }
    if (item.source !== "患者报失" && claimerNote.length < 10) {
      return res.status(400).json({ ok: false, msg: "请填写认领人自述特征（至少10个字），如物品颜色/品牌/内含物" });
    }
    if (HIGH_VALUE_CATEGORIES.includes(item.category || "") && !b.claimerPhoto) {
      return res.status(400).json({ ok: false, msg: `「${item.category}」类物品认领必须现场拍摄认领人照片` });
    }
  } else if (claimerPhone && !/^1[3-9]\d{9}$/.test(claimerPhone)) {
    // 编辑模式：传了电话就校验格式，但不强制补全历史数据
    return res.status(400).json({ ok: false, msg: "手机号格式不正确（11位，1开头）" });
  }

  // C. 患者报失来源：手机号一致性软拦截（两种模式都生效）
  let mismatch: { reason: string; note?: string } | null = null;
  if (item.source === "患者报失") {
    const rep = await prisma.lostReport.findFirst({ where: { matchedItemId: item.id } });
    if (rep && rep.ownerPhone !== claimerPhone) {
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
  }

  // A. 认领时补录登记特征（可选，≥5字才采纳）
  let descriptionTopUp: string | undefined;
  if (b.description !== undefined) {
    const d = String(b.description || "").trim();
    if (d.length >= 5) descriptionTopUp = d;
  }

  const me = req.authUser!;
  const claimedAt = keep ? (item.claimedAt || parseClaimTime(b.claimedAt)) : parseClaimTime(b.claimedAt);
  // 原子认领（与 v1 对齐）：UPDATE 带状态条件，并发提交只有一个能命中，
  // 其余返回"刚被其他人认领"——不能用先查再改（check-then-act）的写法。
  const data = {
    status: "已认领",
    claimerName,
    claimerPhone: claimerPhone || null,
    claimerGroup: b.claimerGroup || null,
    claimerGender: b.claimerGender || null,
    featureVerified: true,
    claimedAt,
    operator: me.name,
    // 新认领必填自述特征；编辑时传了才更新
    claimerNote: !keep ? claimerNote : (claimerNote || item.claimerNote),
    ...(descriptionTopUp ? { description: descriptionTopUp } : {}),
    ...(keep ? {} : { claimerPhoto: b.claimerPhoto || null }),
  };
  const result = keep
    ? await prisma.item.updateMany({ where: { id, status: "已认领" }, data })
    : await prisma.item.updateMany({ where: { id, status: "待认领" }, data });
  if (result.count === 0) {
    return res.status(409).json({
      ok: false,
      msg: keep ? "该物品认领状态已变化，请刷新后再修改" : "该物品刚被其他人认领，请刷新确认",
    });
  }
  const updated = await prisma.item.findUnique({ where: { id } });
  if (!updated) return res.status(404).json({ ok: false, msg: "物品不存在" });
  // 患者报失来源：认领完成（取走）→ 联动报失记录进入「已取走」终点
  if (!keep && item.source === "患者报失") {
    await prisma.lostReport.updateMany({
      where: { matchedItemId: id, status: { in: ["已登记", "待领取"] } },
      data: {
        status: "已找到",
        note: `已由${claimerName}取走（编号${item.code}）`,
        handledBy: me.name,
        handledAt: fmt(new Date()),
      },
    });
  }
  await audit(req, keep ? "edit_claim" : "claim", "item", id, {
    code: item.code, claimerName, claimerPhone, claimerNote,
    ...(mismatch ? { mismatch } : {}),
  });
  res.json({
    ok: true, item: out(updated),
    msg: keep ? "认领信息已更新" : `认领登记完成：${item.code} 已归还给 ${claimerName}`,
  });
});

// ===== POST /api/items/:id/confirm-found —— 患者报失物品的「找到」=====
// 失物总表操作列的入口：联动关联报失记录 已登记→待领取（患者进度条推到"已找到"）
router.post("/:id/confirm-found", async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) return res.status(404).json({ ok: false, msg: "物品不存在" });
  if (item.source !== "患者报失") {
    return res.status(400).json({ ok: false, msg: "仅患者报失来源的物品需要「确认找到」" });
  }
  const rep = await prisma.lostReport.findFirst({ where: { matchedItemId: id, status: "已登记" } });
  if (!rep) {
    return res.status(400).json({ ok: false, msg: "该物品的报失记录不在「已登记」状态（可能已确认过或已取走）" });
  }
  const me = req.authUser!;
  const note = String(req.body?.note || "").trim() || "物品已找到，请尽快到门诊导医台核对认领";
  await prisma.lostReport.update({
    where: { id: rep.id },
    data: { status: "待领取", note, handledBy: me.name, handledAt: fmt(new Date()) },
  });
  await audit(req, "item_confirm_found", "item", id, { code: item.code, reportId: rep.id, note });
  res.json({ ok: true, msg: `已确认找到，报失患者将看到「已找到，请尽快来领」` });
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
      claimedAt: null, operator: null, featureVerified: false, claimerPhoto: null, claimerNote: null,
    },
  });
  removePhotoFiles([item.claimerPhoto]);
  // 患者报失来源：撤销取走 → 报失记录退回「待领取」
  if (item.source === "患者报失") {
    await prisma.lostReport.updateMany({
      where: { matchedItemId: id, status: "已找到" },
      data: { status: "待领取", note: "取走登记已撤销，物品重新待认领" },
    });
  }
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
