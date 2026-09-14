// 失物编号：YYYYMMDD-NNN（当日序号递增，与 v1 一致）
import { prisma } from "../lib/prisma";

export async function generateItemCode(): Promise<string> {
  const today = new Date();
  const y = today.getFullYear();
  const mo = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `${y}${mo}${d}-`;

  const last = await prisma.item.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  const seq = last ? parseInt(last.code.split("-")[1], 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}
