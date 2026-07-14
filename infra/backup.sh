#!/usr/bin/env bash
# Denná záloha PostgreSQL databázy portálu FKKNV.
# Spúšťa sa cronom na VPS (pozri docs/07-deployment.md, krok 7).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/fkknv/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

docker compose -f /opt/fkknv/app/infra/docker-compose.yml exec -T postgres \
  pg_dump -U fkknv --format=custom fkknv > "$BACKUP_DIR/fkknv-$STAMP.dump"

# zmaž zálohy staršie ako RETENTION_DAYS
find "$BACKUP_DIR" -name 'fkknv-*.dump' -mtime "+$RETENTION_DAYS" -delete

echo "Záloha OK: $BACKUP_DIR/fkknv-$STAMP.dump ($(du -h "$BACKUP_DIR/fkknv-$STAMP.dump" | cut -f1))"
