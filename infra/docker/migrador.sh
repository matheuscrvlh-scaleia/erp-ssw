#!/bin/sh
# Entrypoint da imagem erp-migrador. Uso (na VPS, em infra/):
#   docker compose run --rm migrador migrar   # migrations do schema erp (drizzle-kit migrate)
#   docker compose run --rm migrador semear   # catálogo global (telas, módulos), idempotente
#   docker compose run --rm migrador dados [args]   # migrador de dados public → erp
# Conecta com DATABASE_URL_MIGRACAO (papel erp_migracao), nunca com o papel do app.
set -eu

ajuda() {
  sed -n '2,6p' "$0" | sed 's/^# \{0,1\}//'
}

exigir_url_de_migracao() {
  if [ -z "${DATABASE_URL_MIGRACAO:-}" ]; then
    echo "Defina DATABASE_URL_MIGRACAO (papel erp_migracao) no infra/.env." >&2
    exit 2
  fi
}

comando="${1:-ajuda}"
[ "$#" -gt 0 ] && shift

case "$comando" in
  migrar)
    exigir_url_de_migracao
    # O drizzle.config.ts usa caminhos relativos ao packages/db.
    cd /app/packages/db
    exec node /app/node_modules/drizzle-kit/bin.cjs migrate "$@"
    ;;
  semear)
    exigir_url_de_migracao
    cd /app/packages/db
    exec node --import tsx src/seeds/executar.ts "$@"
    ;;
  dados)
    cd /app/apps/migrador 2>/dev/null || {
      echo "Esta imagem não tem o apps/migrador (versão anterior à entrega dele)." >&2
      exit 2
    }
    if [ -f dist/main.js ]; then
      exec node --enable-source-maps dist/main.js "$@"
    fi
    exec node --import tsx src/main.ts "$@"
    ;;
  ajuda | -h | --help)
    ajuda
    ;;
  *)
    echo "Comando desconhecido: $comando" >&2
    ajuda >&2
    exit 2
    ;;
esac
