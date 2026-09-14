import { Router } from "express";
import bcrypt from "bcryptjs";
import cookieParser from "cookie-parser";
import { prisma } from "../lib/prisma";
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from "../middleware/auth";
import { audit } from "../middleware/audit";

const router = Router();
router.use(cookieParser());

// POST /api/auth/login { username, password }
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ ok: false, msg: "请输入账号和密码" });
  }
  const user = await prisma.user.findUnique({ where: { username: String(username).trim() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await audit(req, "login_fail", "auth", user?.id ?? null, { username });
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
