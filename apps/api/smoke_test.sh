#!/bin/bash
# lostfound-v2 冒烟测试：起测试实例 → 12 项验证 → 关闭。只打测试库 lostfound_smoke。
cd "$(dirname "$0")"
# 从 .env 读真实连接串，仅替换库名（密码不硬编码在脚本里）
SRC_DB_URL=$(grep -oP '^DATABASE_URL="\K[^"]+' .env)
export DATABASE_URL="${SRC_DB_URL%/*}/lostfound_smoke"
export API_PORT=8010
export JWT_SECRET=smoke-test-secret
./node_modules/.bin/tsx src/index.ts > /tmp/v2_smoke_server.log 2>&1 &
SRV=$!
trap "kill $SRV 2>/dev/null" EXIT
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:8010/api/health && break; sleep 0.5; done

B=http://127.0.0.1:8010
# 所有 curl 统一加超时，任何单步卡住最多 15 秒，不再拖死整轮
curl() { command curl --max-time 15 "$@"; }
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "❌ $1 —— $2"; }

# 1 健康检查
curl -s $B/api/health | grep -q '"ok":true' && ok "1 健康检查" || bad "1 健康检查" "$(curl -s $B/api/health)"

# 2 公众报失提交（新功能文案：提示查进度）
R=$(curl -s -X POST $B/api/public/report -H 'Content-Type: application/json' -H 'X-Forwarded-For: 1.1.1.1' \
  -d '{"ownerName":"测试失主","ownerPhone":"13711112222","itemName":"黑色钱包","itemCategory":"钱包","description":"内有医保卡"}')
echo "$R" | grep -q '"ok":true' && echo "$R" | grep -q "查询我的报失" && ok "2 报失提交+新提示文案" || bad "2 报失提交" "$R"

# 3 查询我的报失（v1 对齐的新接口）
R=$(curl -s -X POST $B/api/public/my-reports -H 'Content-Type: application/json' -d '{"phone":"13711112222"}')
echo "$R" | grep -q '"ok":true' && echo "$R" | grep -q "黑色钱包" && echo "$R" | grep -q "待查找" && ok "3 my-reports 查到记录且不泄露他人" || bad "3 my-reports" "$R"
# 他人手机号查不到
R=$(curl -s -X POST $B/api/public/my-reports -H 'Content-Type: application/json' -d '{"phone":"13999998888"}')
echo "$R" | grep -q '"reports":\[\]' && ok "3b my-reports 空结果" || bad "3b my-reports 空结果" "$R"

# 4 登录失败限流：5 次失败后第 6 次 429
for i in 1 2 3 4 5; do curl -s -o /dev/null -X POST $B/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 2.2.2.2' -d '{"username":"smokeadmin","password":"wrong"}'; done
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 2.2.2.2' -d '{"username":"smokeadmin","password":"smoke123"}')
[ "$CODE" = "429" ] && ok "4 登录失败限流（第6次被拒）" || bad "4 登录失败限流" "HTTP $CODE"
# 换一个 IP 不受牵连（证明按 IP 分桶 + trust proxy 生效）
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 9.9.9.9' -d '{"username":"smokeadmin","password":"smoke123"}')
[ "$CODE" = "200" ] && ok "4b 不同IP不受限流牵连（trust proxy 生效）" || bad "4b trust proxy" "HTTP $CODE"

# 5 正常登录拿 cookie
curl -s -c /tmp/v2_cookie.txt -X POST $B/api/auth/login -H 'Content-Type: application/json' -H 'X-Forwarded-For: 9.9.9.9' -d '{"username":"smokeadmin","password":"smoke123"}' | grep -q '"ok":true' && ok "5 正常登录" || bad "5 正常登录" "见cookie文件"

# 6 登记带公式注入名称的物品
R=$(curl -s -b /tmp/v2_cookie.txt -X POST $B/api/items -H 'Content-Type: application/json' \
  -d '{"name":"=HYPERLINK(\"http://evil.example\",\"点我\")","category":"其他","storageLocation":"导诊台1号抽屉"}')
echo "$R" | grep -q '"ok":true' && ok "6 登记特殊名称物品" || bad "6 登记物品" "$R"

# 7 hiddenPhotos 非子集被拒
ID=$(curl -s -b /tmp/v2_cookie.txt "$B/api/items?q=HYPERLINK" | python3 -c "import sys,json;print(json.load(sys.stdin)['items'][0]['id'])")
CODE=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/v2_cookie.txt -X PUT $B/api/items/$ID -H 'Content-Type: application/json' -d '{"name":"=HYPERLINK(\"http://evil.example\",\"点我\")","hiddenPhotos":"not_a_photo.jpg"}')
[ "$CODE" = "400" ] && ok "7 hiddenPhotos 非子集被拒(400)" || bad "7 hiddenPhotos 校验" "HTTP $CODE"

# 8 认领并发竞态：两个并发认领只能成一个
curl -s -b /tmp/v2_cookie.txt -X POST $B/api/items -H 'Content-Type: application/json' -d '{"name":"并发测试物","storageLocation":"导诊台"}' > /dev/null
ID2=$(curl -s -b /tmp/v2_cookie.txt -G "$B/api/items" --data-urlencode "q=并发测试" | python3 -c "import sys,json;print(json.load(sys.stdin)['items'][0]['id'])")
curl -s -b /tmp/v2_cookie.txt -X POST $B/api/items/$ID2/claim -H 'Content-Type: application/json' -d '{"claimerName":"甲","featureVerified":true}' > /tmp/claim_a.json & PA=$!
curl -s -b /tmp/v2_cookie.txt -X POST $B/api/items/$ID2/claim -H 'Content-Type: application/json' -d '{"claimerName":"乙","featureVerified":true}' > /tmp/claim_b.json & PB=$!
wait $PA $PB   # 注意：必须显式指定 PID，裸 wait 会连常驻的 API 服务器一起等
OKS=$(grep -l '"ok":true' /tmp/claim_a.json /tmp/claim_b.json | wc -l | tr -d ' ')
FAILS=$(grep -l '"ok":false' /tmp/claim_a.json /tmp/claim_b.json | wc -l | tr -d ' ')
if [ "$OKS" = "1" ] && [ "$FAILS" = "1" ]; then
  ok "8 认领并发竞态：恰一个成功，另一个被拒不覆盖"
else
  bad "8 认领并发" "成功=$OKS 拒绝=$FAILS a=$(cat /tmp/claim_a.json) b=$(cat /tmp/claim_b.json)"
fi

# 9 报失→登记入总表→撤销登记 闭环
curl -s -X POST $B/api/public/report -H 'Content-Type: application/json' -H 'X-Forwarded-For: 5.5.5.5' \
  -d '{"ownerName":"闭环失主","ownerPhone":"13655556666","itemName":"一串钥匙"}' > /dev/null
RID=$(curl -s -b /tmp/v2_cookie.txt -G "$B/api/reports" --data-urlencode "status=待查找" --data-urlencode "q=闭环失主" | python3 -c "import sys,json;print(json.load(sys.stdin)['reports'][0]['id'])")
R=$(curl -s -b /tmp/v2_cookie.txt -X POST $B/api/reports/$RID/register -H 'Content-Type: application/json' -d '{}')
echo "$R" | grep -q '"ok":true' && ok "9a 报失登记入总表" || bad "9a 登记入总表" "$R"
R=$(curl -s -b /tmp/v2_cookie.txt -X POST $B/api/reports/$RID/undo-register -H 'Content-Type: application/json' -d '{}')
echo "$R" | grep -q '"ok":true' && ok "9b 撤销登记闭环" || bad "9b 撤销登记" "$R"
R=$(curl -s -b /tmp/v2_cookie.txt -G "$B/api/reports" --data-urlencode "status=all" --data-urlencode "q=闭环失主")
echo "$R" | grep -q '待查找' && ok "9c 报失恢复待查找" || bad "9c 状态回滚" "$R"
# 重复撤销应被拒
CODE=$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/v2_cookie.txt -X POST $B/api/reports/$RID/undo-register -H 'Content-Type: application/json' -d '{}')
[ "$CODE" = "400" ] && ok "9d 重复撤销被拒(400)" || bad "9d 重复撤销" "HTTP $CODE"

# 10 导出 Excel：魔数 PK + 公式注入被中和
curl -s -b /tmp/v2_cookie.txt -o /tmp/v2_export.xlsx "$B/api/stats/export"
MAGIC=$(xxd -p -l 2 /tmp/v2_export.xlsx)
[ "$MAGIC" = "504b" ] && ok "10a 导出是合法 xlsx(PK)" || bad "10a 导出魔数" "$MAGIC"
python3 - <<'PY'
import zipfile
z = zipfile.ZipFile('/tmp/v2_export.xlsx')
# 字符串可能在 sharedStrings.xml 或内联单元格，全包扫描
blob = ''.join(z.read(n).decode('utf8', 'ignore') for n in z.namelist() if n.endswith('.xml'))
if "'=HYPERLINK" in blob or "&apos;=HYPERLINK" in blob:
    print("✅ 10b 公式注入已被单引号中和")
elif "=HYPERLINK" in blob:
    print("❌ 10b 公式注入未中和（存在裸 = 开头单元格）")
else:
    print("❌ 10b 导出内容里找不到测试物品，异常")
PY

# 11 公众报失限流按 IP 分桶（trust proxy 下 XFF 生效）：10 条 OK，第 11 条 429
for i in $(seq 1 10); do curl -s -o /dev/null -X POST $B/api/public/report -H 'Content-Type: application/json' -H 'X-Forwarded-For: 6.6.6.6' -d "{\"ownerName\":\"批量$i\",\"ownerPhone\":\"1370000000$i\",\"itemName\":\"测试物品$i\"}"; done
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $B/api/public/report -H 'Content-Type: application/json' -H 'X-Forwarded-For: 6.6.6.6' -d '{"ownerName":"批量11","ownerPhone":"13700000011","itemName":"测试物品11"}')
[ "$CODE" = "429" ] && ok "11 报失限流 10条/小时，第11条429" || bad "11 报失限流" "HTTP $CODE"

# 12 未登录访问管理接口 → 401
CODE=$(curl -s -o /dev/null -w '%{http_code}' $B/api/items)
[ "$CODE" = "401" ] && ok "12 未登录管理接口 401" || bad "12 鉴权" "HTTP $CODE"

echo ""
echo "===== 结果：$PASS 通过 / $FAIL 失败 ====="
exit $FAIL
