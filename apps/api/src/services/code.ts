// 失物编号：YYYYMMDD-NNN（当日序号递增，与 v1 一致）
import { Prisma, PrismaClient } from "@prisma/client";
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

/** 带编号冲突重试的物品创建（与 v1 的 _insert_item_with_retry 对齐）：
 *  编号是「查当日最大序号+1」，并发登记会撞 code 的 UNIQUE 约束（P2002），
 *  撞了自动换下一个编号重试，而不是把 500 抛给导医。
 *  buildData(code) 负责返回 prisma.item.create 的 data 对象。
 *  所有往 Item 表插入新记录的入口都应走这里，不要自己 generateItemCode + create。 */
export async function createItemWithCodeRetry(
  buildData: (code: string) => Prisma.ItemCreateInput
) {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = await generateItemCode();
    try {
      return await prisma.item.create({ data: buildData(code) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        lastErr = e; // 编号被并发抢占，回滚换号重试
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("编号生成冲突过多，请重试");
}
