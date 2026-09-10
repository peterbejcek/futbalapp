#!/usr/bin/env bash
# Obnova PostgreSQL databázy portálu FKKNV zo zálohy (.dump, formát pg_dump -Fc).
#
#   ⚠️  POZOR: prepíše súčasné dáta v databáze!
#
# Použitie:  restore.sh <cesta/k/zalohe.dump>
# Napr.:     restore.sh /opt/fkknv/backups/daily/fkknv-daily-20260910-033000.dump
set -euo pipefail

FILE="${1:?Zadajte cestu k .dump súboru (napr. /opt/fkknv/backups/daily/fkknv-daily-...dump)}"
[ -f "$FILE" ] || { echo "Súbor neexistuje: $FILE" >&2; exit 1; }

COMPOSE_DIR="${COMPOSE_DIR:-/opt/fkknv/app/infra}"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.yml}"
ENV_ARG=()
[ -f "$COMPOSE_DIR/.env" ] && ENV_ARG=(--env-file "$COMPOSE_DIR/.env")
compose() { docker compose "${ENV_ARG[@]}" -f "$COMPOSE_FILE" "$@"; }

echo "Obnova databázy fkknv zo súboru:"
echo "  $FILE  ($(du -h "$FILE" | cut -f1))"
read -r -p "Naozaj OBNOVIŤ? Súčasné dáta budú prepísané. Napíšte 'yes': " ans
[ "$ans" = "yes" ] || { echo "Zrušené."; exit 0; }

# --clean --if-exists zmaže existujúce objekty pred obnovou; --no-owner ignoruje vlastníctvo
compose exec -T postgres pg_restore -U fkknv -d fkknv --clean --if-exists --no-owner < "$FILE"

echo "Obnova dokončená. Reštartujte API:"
echo "  docker compose ${ENV_ARG[*]} -f $COMPOSE_FILE restart api"
