// 认证中间件 —— 可替换设计
// 本期：JWT（httpOnly cookie）+ 账号密码
// SSO 接入时：只改 verifyToken() 为 auth-service 的 JWKS 公钥校验，
//            并在 login 里换成员工门户跳转流程；业务路由零改动。
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthUser {
  id: number;
  username: string;
  name: string; // 真名，留痕用
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

const COOKIE_NAME = "lf_token";

export function signToken(user: AuthUser): string {
  return jwt.sign(user, process.env.JWT_SECRET || "dev-secret", {
    expiresIn: "12h",
  });
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 12 * 3600 * 1000,
    // secure: true, // HTTPS 部署时打开
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

// —— 可替换点：本期本地 JWT 校验 ——
function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || "dev-secret") as AuthUser;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = (req as any).cookies?.[COOKIE_NAME];
  const bearer = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7)
    : null;
  const user = verifyToken(token || bearer || "");
  if (!user) {
    return res.status(401).json({ ok: false, msg: "未登录或登录已过期" });
  }
  req.authUser = user;
  next();
}
