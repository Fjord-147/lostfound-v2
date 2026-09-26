import { Router } from "express";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import { prisma } from "../lib/prisma";
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";
import { loginFailLimiter } from "../middleware/rateLimit";

const router = Router();
router.use(cookieParser());

// 登录失败限流：同一 IP+账号 10 分钟内最多失败 5 次（防暴力破解，与 v1 对齐）
const loginLimit = loginFailLimiter();

// POST /api/auth/login { username, password }
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  const uname = String(username || "").trim();
  if (!uname || !password) {
    return res.status(400).json({ ok: false, msg: "请输入账号和密码" });
  }
  const limitKey = `${req.ip || "unknown"}:${uname}`;
  if (loginLimit.isBlocked(limitKey)) {
    return res.status(429).json({ ok: false, msg: "登录尝试次数过多，请 10 分钟后再试" });
  }
  const user = await prisma.user.findUnique({ where: { username: uname } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    loginLimit.recordFail(limitKey);
    await audit(req, "login_fail", "auth", user?.id ?? null, { username: uname });
    return res.status(401).json({ ok: false, msg: "账号或密码错误" });
  }
  const authUser = { id: user.id, username: user.username, name: user.name, role: user.role };
  setAuthCookie(res, signToken(authUser));
  await audit(req, "login", "auth", user.id, { username: user.username });
  res.json({ ok: true, user: authUser });
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me（前端恢复会话用）
router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.authUser });
});

export default router;
