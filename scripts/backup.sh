#!/usr/bin/env bash
# MySQL 백업: star + wedding 를 매일 mysqldump, 7일 보관
# 사용: scripts/backup.sh  (cron 예: 0 4 * * * /home/binary/workspace/binary_star/scripts/backup.sh)
# 도커 소켓 권한이 필요함. 안 되면 사용자에게: sudo usermod -aG docker binary (재로그인)
set -euo pipefail
DIR="${BACKUP_DIR:-/home/binary/binaryworld/backups/mysql}"
KEEP_DAYS=7
DBS=(star wedding)
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M)
for db in "${DBS[@]}"; do
  # 비밀번호는 컨테이너 환경변수(MYSQL_ROOT_PASSWORD)에서 읽어 명령줄에 안 남김
  if docker exec mysql-local sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --default-character-set=utf8mb4 '"$db" | gzip > "$DIR/$db-$STAMP.sql.gz"; then
    echo "[backup] $db → $DIR/$db-$STAMP.sql.gz ($(du -h "$DIR/$db-$STAMP.sql.gz" | cut -f1))"
  else
    echo "[backup] $db 실패" >&2
    rm -f "$DIR/$db-$STAMP.sql.gz"
  fi
done
find "$DIR" -name '*.sql.gz' -mtime +$KEEP_DAYS -delete
