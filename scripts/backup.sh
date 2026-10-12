#!/bin/bash
# lostfound-v2 每日备份：PostgreSQL dump + uploads 照片打包 → /opt/backups/（保留 14 天）
# 用法：cron 每日执行；也可手动 bash scripts/backup.sh 立即备份一次
set -e

TS=$(date +%Y%m%d-%H%M%S)
DEST=/opt/backups
ENV_FILE=/opt/lostfound-v2/apps/api/.env
UPLOADS_DIR=/opt/lostfound-v2/uploads

mkdir -p "$DEST"

# 从 .env 读数据库密码（不落盘、不进日志）
DBPW=$(grep -oP 'postgresql://lostfound:\K[^@]+' "$ENV_FILE")
export PGPASSWORD="$DBPW"

pg_dump -U lostfound -h 127.0.0.1 lostfound | gzip > "$DEST/lostfound-v2-db-$TS.sql.gz"
unset PGPASSWORD

tar -czf "$DEST/lostfound-v2-uploads-$TS.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"

# 只留最近 14 份，防磁盘涨满
find "$DEST" -name "lostfound-v2-db-*.sql.gz" -mtime +14 -delete
find "$DEST" -name "lostfound-v2-uploads-*.tar.gz" -mtime +14 -delete

echo "$(date '+%F %T') 备份完成: lostfound-v2-db-$TS.sql.gz + lostfound-v2-uploads-$TS.tar.gz"
