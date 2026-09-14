// 报失处理：列表 / 角标计数 / 登记入总表 / 已找到一步认领 / 忽略 / 重新查找
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { generateItemCode } from "../services/code";

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
  const cnt: Record<string, number> = { 待查找: 0, 已登记: 0, 已找到: 0, 已忽略: 0 };
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
  const code = await generateItemCode();
  const item = await prisma.item.create({
    data: {
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
    },
  });
  await prisma.lostReport.update({
    where: { id },
    data: {
      status: "已登记",
      matchedItemId: item.id,
      note: (req.body?.note as string) || "已转入失物总表",
      handledBy: me.name,
      handledAt: fmtNow(),
    },
  });
  await audit(req, "report_register", "lost_report", id, { code, itemId: item.id });
  res.json({ ok: true, msg: `已登记入失物总表，编号 ${code}（患者报失）`, itemId: item.id, code });
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

  const me = req.authUser!;
  let claimedAt = fmtNow();
  if (b.claimedAt && String(b.claimedAt).includes("T")) {
    const t = String(b.claimedAt).replace("T", " ");
    const m = t.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/);
    if (m) claimedAt = `${m[1]} ${m[2]}:00`;
  }

  const code = await generateItemCode();
  const item = await prisma.item.create({
    data: {
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
      claimerPhone: String(b.claimerPhone || "").trim() || null,
      claimerGroup: b.claimerGroup || null,
      claimerGender: b.claimerGender || null,
      featureVerified: true,
      claimedAt,
      operator: me.name,
      claimerPhoto: b.claimerPhoto || null,
    },
  });
  await prisma.lostReport.update({
    where: { id },
    data: {
      status: "已找到",
      matchedItemId: item.id,
      note: `已找到并认领，编号${code}`,
      handledBy: me.name,
      handledAt: fmtNow(),
    },
  });
  await audit(req, "report_found_claim", "lost_report", id, { code, itemId: item.id, claimerName });
  res.json({ ok: true, msg: `已找到并认领完成，编号 ${code}（患者报失）` });
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
