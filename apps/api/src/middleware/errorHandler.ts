import { Request, Response, NextFunction } from "express";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error("[error]", err);
  res.status(500).json({ ok: false, msg: "服务器内部错误" });
}
