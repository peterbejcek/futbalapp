#!/usr/bin/env bash
# Záloha PostgreSQL databázy portálu FKKNV do vrstiev daily / weekly / monthly
# (grandfather-father-son). Spúšťa cron na VPS (pozri docs/07-deployment.md).
#
# Použitie:  backup.sh [daily|weekly|monthly]      (predvolené: daily)
#
# Zálohy sa ukladajú do $BACKUP_DIR/<vrstva>/ a v každej vrstve sa ponecháva len
# posledných RETAIN_* súborov. Formát je pg_dump -Fc (komprimovaný, vhodný pre
# pg_restore a čiastočnú obnovu).
set -euo pipefail

TIER="${1:-daily}"
case "$TIER" in
  daily | weekly | monthly) ;;
  *) echo "Neznáma vrstva: '$TIER' (použite daily | weekly | monthly)" >&2; exit 2 ;;
esac

BACKUP_ROOT="${BACKUP_DIR:-/opt/fkknv/backups}"
COMPOSE_DIR="${COMPOSE_DIR:-/opt/fkknv/app/infra}"
COMPOSE_FILE="${COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.yml}"

# koľko záloh ponechať v jednotlivých vrstvách (dá sa prepísať cez env)
RETAIN_DAILY="${RETAIN_DAILY:-14}"     # ~2 týždne denných
RETAIN_WEEKLY="${RETAIN_WEEKLY:-8}"    # ~2 mesiace týždenných
RETAIN_MONTHLY="${RETAIN_MONTHLY:-12}" # 1 rok mesačných

case "$TIER" in
  daily) RETAIN="$RETAIN_DAILY" ;;
  weekly) RETAIN="$RETAIN_WEEKLY" ;;
  monthly) RETAIN="$RETAIN_MONTHLY" ;;
esac

DIR="$BACKUP_ROOT/$TIER"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$DIR/fkknv-$TIER-$STAMP.dump"
mkdir -p "$DIR"

# docker compose potrebuje premenné z .env (compose súbor má ${POSTGRES_PASSWORD:?...})
ENV_ARG=()
[ -f "$COMPOSE_DIR/.env" ] && ENV_ARG=(--env-file "$COMPOSE_DIR/.env")
compose() { docker compose "${ENV_ARG[@]}" -f "$COMPOSE_FILE" "$@"; }

# najprv do dočasného súboru; finálny .dump vznikne až po úspešnom overení
TMP="$(mktemp "$DIR/.fkknv-$TIER-XXXXXX.tmp")"
trap 'rm -f "$TMP"' EXIT

compose exec -T postgres pg_dump -U fkknv -Fc fkknv > "$TMP"

# overenie: dump musí byť neprázdny a čitateľný (pg_restore -l vypíše obsah)
[ -s "$TMP" ] || { echo "CHYBA: prázdny dump — neukladám." >&2; exit 1; }
if ! compose exec -T postgres pg_restore -l < "$TMP" >/dev/null 2>&1; then
  echo "CHYBA: dump sa nedá prečítať (pg_restore -l zlyhal) — neukladám." >&2
  exit 1
fi

mv "$TMP" "$OUT"
trap - EXIT

# retencia: ponechaj len posledných RETAIN súborov v tejto vrstve
mapfile -t OLD < <(ls -1t "$DIR"/fkknv-"$TIER"-*.dump 2>/dev/null | tail -n +"$((RETAIN + 1))" || true)
for f in "${OLD[@]}"; do [ -n "$f" ] && rm -f "$f"; done

echo "Záloha OK [$TIER]: $OUT ($(du -h "$OUT" | cut -f1)); ponechaných max $RETAIN."
