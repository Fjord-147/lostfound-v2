// 统计 + Excel 导出（exceljs，全字段）+ 审计日志查询
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { normDate } from "../services/sanitize";
import ExcelJS from "exceljs";

const router = Router();
router.use(requireAuth);

// GET /api/stats/summary?dateFrom=&dateTo=
router.get("/summary", async (req, res) => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const dateFrom = normDate((req.query.dateFrom as string) || `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`);
  const dateTo = normDate((req.query.dateTo as string) || `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
  const gte = new Date(dateFrom + "T00:00:00");
  const lte = new Date(dateTo + "T23:59:59");

  const [foundCount, returnedCount, pendingCount, byCategory] = await Promise.all([
    prisma.item.count({ where: { createdAt: { gte, lte } } }),
    // claimedAt 是 "YYYY-MM-DD HH:MM:SS" 字符串，比较时两端补全天/秒边界
    prisma.item.count({
      where: {
        status: "已认领",
        claimedAt: { gte: dateFrom + " 00:00:00", lte: dateTo + " 23:59:59" },
      },
    }),
    prisma.item.count({ where: { status: "待认领", createdAt: { gte, lte } } }),
    prisma.item.groupBy({
      by: ["category"],
      where: { createdAt: { gte, lte } },
      _count: true,
      orderBy: { _count: { category: "desc" } },
    }),
  ]);
  res.json({
    ok: true,
    dateFrom, dateTo,
    stats: { foundCount, returnedCount, pendingCount },
    byCategory: byCategory.map((c) => ({ category: c.category || "未分类", count: c._count })),
  });
});

// GET /api/stats/export?dateFrom=&dateTo= —— Excel 导出
router.get("/export", async (req, res) => {
  const dateFrom = normDate((req.query.dateFrom as string) || "");
  const dateTo = normDate((req.query.dateTo as string) || "");
  const where: any = {};
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom + "T00:00:00");
    if (dateTo) where.createdAt.lte = new Date(dateTo + "T23:59:59");
  }
  const items = await prisma.item.findMany({ where, orderBy: { id: "desc" } });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("失物登记清单");
  ws.columns = [
    { header: "失物编号", key: "code", width: 14 },
    { header: "物品名称", key: "name", width: 16 },
    { header: "类别", key: "category", width: 12 },
    { header: "特征描述", key: "description", width: 30 },
    { header: "捡到地点", key: "foundLocation", width: 14 },
    { header: "存放位置", key: "storageLocation", width: 14 },
    { header: "捡到时间", key: "foundTime", width: 16 },
    { header: "捡到人", key: "founder", width: 10 },
    { header: "登记人", key: "registeredBy", width: 10 },
    { header: "来源", key: "source", width: 10 },
    { header: "状态", key: "status", width: 10 },
    { header: "登记时间", key: "createdAt", width: 18 },
    { header: "认领人姓名", key: "claimerName", width: 12 },
    { header: "认领人电话", key: "claimerPhone", width: 14 },
    { header: "人群", key: "claimerGroup", width: 8 },
    { header: "性别", key: "claimerGender", width: 8 },
    { header: "特征已核实", key: "featureVerified", width: 10 },
    { header: "认领时间", key: "claimedAt", width: 18 },
    { header: "经办人", key: "operator", width: 10 },
    { header: "物品照片", key: "photo", width: 24 },
    { header: "认领人照片", key: "claimerPhoto", width: 24 },
  ];
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0891B2" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const it of items) {
    ws.addRow({
      code: it.code, name: it.name, category: it.category, description: it.description,
      foundLocation: it.foundLocation, storageLocation: it.storageLocation,
      foundTime: it.foundTime, founder: it.founder, registeredBy: it.registeredBy,
      source: it.source || "导医登记", status: it.status,
      createdAt: it.createdAt ? it.createdAt.toISOString().replace("T", " ").slice(0, 19) : "",
      claimerName: it.claimerName, claimerPhone: it.claimerPhone,
      claimerGroup: it.claimerGroup, claimerGender: it.claimerGender,
      featureVerified: it.claimerName ? (it.featureVerified ? "是" : "否") : "",
      claimedAt: it.claimedAt, operator: it.operator,
      photo: it.photo, claimerPhoto: it.claimerPhoto,
    });
  }
  await audit(req, "export_excel", "item", null, { dateFrom, dateTo, count: items.length });
  const buf = await wb.xlsx.writeBuffer();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename="lostfound_${today}.xlsx"`);
  res.send(Buffer.from(buf));
});

// GET /api/stats/audit?take=100 —— 审计日志查询（管理员可查）
router.get("/audit", async (req, res) => {
  const take = Math.min(Number(req.query.take) || 100, 500);
  const logs = await prisma.auditLog.findMany({ orderBy: { id: "desc" }, take });
  res.json({ ok: true, logs });
});

export default router;
