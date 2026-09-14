// 审计日志（标准：操作人/时间/类型/变更内容）
// 用法：在路由成功执行后调用 audit(req, action, entity, entityId, detail)
import { Request } from "express";
import { prisma } from "../lib/prisma";
import { AuthUser } from "./auth";

export async function audit(
  req: Request,
  action: string,
  entity: string,
  entityId: number | null,
  detail: Record<string, unknown>
) {
  try {
    const user = req.authUser as AuthUser | undefined;
    await prisma.auditLog.create({
      data: {
        operator: user?.name || "公众",
        action,
        entity,
        entityId: entityId ?? undefined,
        detail: detail as any,
      },
    });
  } catch (e) {
    // 审计失败不阻断业务，但要打出来排查
    console.error("[audit] 写入失败:", e);
  }
}
