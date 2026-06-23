#!/bin/bash
# ──────────────────────────────────────────────
# 漫语町 PostgreSQL 自动备份脚本
# 用法: 0 3 * * * /path/to/backup-db.sh >> /var/log/manyu-backup.log 2>&1
# ──────────────────────────────────────────────
set -euo pipefail

# ── 配置 ──
BACKUP_DIR="${BACKUP_DIR:-/var/backups/manyu}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
DB_CONTAINER="${DB_CONTAINER:-manyu-db}"
DB_NAME="${DB_NAME:-manyu}"
DB_USER="${DB_USER:-manyu}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 开始备份 ${DB_NAME}..."

# ── 导出并压缩 ──
docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl \
  | gzip > "${BACKUP_FILE}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份完成: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# ── 清理旧备份 ──
DELETED=$(find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete -print)
if [ -n "${DELETED}" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] 清理过期备份:"
  echo "${DELETED}"
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 备份任务结束"
