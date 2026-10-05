#!/bin/bash
# lostfound-v2 一键部署：pull → build api+web → pm2 restart → 健康检查
# 用法：./deploy.sh        （在服务器 /opt/lostfound-v2 下执行）
set -e
cd "$(dirname "$0")"

echo "=== 1/5 拉取最新代码 ==="
git pull --ff-only

echo "=== 2/6 编译后端 ==="
pnpm --filter @lostfound/api build

echo "=== 3/6 数据库迁移（如有新迁移文件自动应用）==="
pnpm --filter @lostfound/api exec prisma migrate deploy

echo "=== 4/6 构建前端 ==="
pnpm --filter @lostfound/web build

echo "=== 5/6 重启服务 ==="
pm2 restart lostfound-api lostfound-web
echo "=== 6/6 健康检查（最多等 30 秒，服务预热有重试）==="
FAIL=0
HTTP=000; API=0; ONLINE=0
for i in $(seq 1 10); do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:8082/ || echo 000)
  API=$(curl -s --max-time 5 http://127.0.0.1:8082/api/public/items | grep -c '"ok":true' || true)
  ONLINE=$(pm2 jlist | python3 -c "import json,sys; a=json.load(sys.stdin); print(sum(1 for p in a if p['name'] in ('lostfound-api','lostfound-web') and p['pm2_env']['status']=='online'))" 2>/dev/null || echo 0)
  [ "$HTTP" = "200" ] && [ "$API" -ge 1 ] && [ "$ONLINE" = "2" ] && break
  sleep 3
done
echo "首页 HTTP $HTTP / API ok=$API / 进程 online=$ONLINE/2"
[ "$HTTP" = "200" ] || FAIL=1
[ "$API" -ge 1 ] || FAIL=1
[ "$ONLINE" = "2" ] || FAIL=1

if [ "$FAIL" = "0" ]; then
  echo "===== 部署成功 ====="
  git log --oneline -1
else
  echo "===== 部署完成但有异常，请检查上方输出和 pm2 logs ====="
  exit 1
fi
