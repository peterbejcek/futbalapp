#!/usr/bin/env bash
# FKKNV portál — lokálne skúšobné prostredie jedným príkazom.
# Potrebuje iba Docker (Docker Desktop na Mac/Windows, docker na Linuxe).
#
#   ./quickstart.sh          postaví a spustí všetko
#   ./quickstart.sh stop     zastaví kontajnery (dáta ostanú)
#   ./quickstart.sh reset    zastaví a ZMAŽE aj databázu
set -euo pipefail
cd "$(dirname "$0")"

COMPOSE=(docker compose -f infra/docker-compose.local.yml)

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker nie je nainštalovaný. Stiahnite si Docker Desktop: https://www.docker.com/products/docker-desktop/"
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "❌ Docker beží? Spustite Docker Desktop a skúste znova."
  exit 1
fi

case "${1:-up}" in
  stop)
    "${COMPOSE[@]}" stop
    echo "⏹  Zastavené. Znova spustíte: ./quickstart.sh"
    exit 0
    ;;
  reset)
    "${COMPOSE[@]}" down -v
    echo "🗑  Zmazané vrátane databázy. Čistý štart: ./quickstart.sh"
    exit 0
    ;;
  up) ;;
  *)
    echo "Použitie: ./quickstart.sh [stop|reset]"
    exit 1
    ;;
esac

echo "🏗  Staviam a spúšťam (prvý beh stiahne závislosti, ~5–10 min)…"
"${COMPOSE[@]}" up -d --build

echo -n "⏳ Čakám na API"
for i in $(seq 1 60); do
  if curl -sf http://localhost:3001/api/v1/health >/dev/null 2>&1; then break; fi
  echo -n "."
  sleep 2
  if [ "$i" -eq 60 ]; then
    echo; echo "❌ API nenabehlo. Logy: docker compose -f infra/docker-compose.local.yml logs api"
    exit 1
  fi
done
echo " ✓"

echo -n "⏳ Čakám na web"
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then break; fi
  echo -n "."
  sleep 2
done
echo " ✓"

cat <<EOF

✅ Portál beží!

   Web:       http://localhost:3000
   API:       http://localhost:3001/api/v1/health
   Prihlásenie: admin@fkknv.sk / fkknv-admin

   Skúste: registráciu člena, členov, platby, chat, športový príspevok.

   Zastaviť:      ./quickstart.sh stop
   Čistý reštart: ./quickstart.sh reset
   Logy:          docker compose -f infra/docker-compose.local.yml logs -f
EOF
