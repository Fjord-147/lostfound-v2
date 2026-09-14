# 苏州和康中医医院 · 失物招领管理系统 v2

按《医院内部新项目技术开发标准》建设的失物招领平台：公众端（半盲防冒领）+ 管理端（登记/认领/报失/统计/审计）。

## 技术栈（符合院标）

> Node.js 22 · pnpm workspace · Next.js 15.5 · React 19 · TypeScript 5.6 · Tailwind CSS 3.4 · Express 4 · Prisma 5.22 · PostgreSQL · JWT（SSO 预留）

```
apps/web   Next.js 前端 :3000
apps/api   Express API  :8000（/api/health 健康检查）
           PostgreSQL   （Prisma migration 管理）
```

## 本地开发

```bash
# 0) 准备 PostgreSQL，建库建账号（独立库+独立账号，不用超级管理员）
createdb lostfound
psql -d postgres -c "CREATE USER lostfound WITH PASSWORD '***';"

# 1) 配置环境变量（复制示例，勿提交真实值）
cp apps/api/.env.example apps/api/.env   # 填 DATABASE_URL / JWT_SECRET / SEED_*

# 2) 安装依赖 + 建表 + 初始账号
pnpm install
pnpm migrate    # prisma migrate dev
pnpm seed       # 创建 .env 里的初始账号

# 3) 启动（前端3000 + 后端8000）
pnpm dev
```

## 生产部署（医院内网）

### 环境
- Node.js **22**（院标指定版本）
- pnpm 9+
- PostgreSQL 16（独立数据库账号，禁用超级管理员）

### 步骤
```bash
# 代码
git clone <repo> /opt/lostfound-v2 && cd /opt/lostfound-v2
pnpm install --frozen-lockfile

# 配置（服务端环境变量注入，禁止写入代码/Git）
cp apps/api/.env.example apps/api/.env && vim apps/api/.env
#   DATABASE_URL / JWT_SECRET(openssl rand -hex 32) / SEED_*

# 数据库
pnpm --filter @lostfound/api exec prisma migrate deploy   # 生产用 deploy，不用 dev
pnpm seed

# 构建 + 进程守护（pm2）
pnpm build
pm2 start apps/api/dist/index.js --name lf-api
pm2 start "pnpm --dir apps/web start" --name lf-web
pm2 save && pm2 startup

# nginx 反代（建议：同域路径分流，为以后 HTTPS 做准备）
#   /        → 127.0.0.1:3000（web）
#   /api/*   → 127.0.0.1:8000（api，含 cookie 透传）
```

### SSO 接入（待信息科提供 auth-service 文档后）
认证收口在 `apps/api/src/middleware/auth.ts`：
- `signToken/setAuthCookie`：换成员工门户跳转 + auth-service 签发的 JWT
- `verifyToken()`：换为 auth-service 的 JWKS 公钥校验
- 业务路由与前端零改动；users 表可加 `externalId` 映射列（migration）

## 数据安全与备份

- 患者数据、照片、数据库、`.env` **均不入 Git**（见 .gitignore）
- 上传附件存 `uploads/`（应用私有目录），数据库仅存文件名元数据
- 敏感操作（删除/撤销）需输入“确认”二字；全量操作有审计日志（`audit_logs` 表，统计页可查）

### 备份与恢复
```bash
# 备份（建议 crontab 每日 2:10，保留30天）
pg_dump -U lostfound -d lostfound | gzip > /opt/backups/lf_$(date +%F).sql.gz
tar czf /opt/backfound/lf_uploads_$(date +%F).tar.gz -C /opt/lostfound-v2 uploads
find /opt/backups -mtime +30 -delete

# 恢复
gunzip -c lf_日期.sql.gz | psql -U lostfound -d lostfound
tar xzf lf_uploads_日期.tar.gz -C /opt/lostfound-v2
```

## 待办（院标接入项）

- [ ] 接入员工门户 / auth-service SSO（资料到位后，见上文接入点）
- [ ] 统一服务注册表登记（服务名/端口/路径/依赖）
- [ ] 医院共享 UI 组件替换（当前 Tailwind 自研风格）
- [ ] 自动化测试补充（当前以 E2E 手工清单验收）
