#!/usr/bin/env bash
# Copia @erp/shared e @erp/dominio da api (origem) para o web (ADR 0013).
# Na api, @erp/shared mora em views/contratos, views/contrato.ts e models/comum (MVC, ADR 0014);
# no web, tudo fica em src/shared. Com --conferir, só compara e sai com erro se houver diferença.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
api="$raiz/apps/api/src"
web="$raiz/apps/web/src"

montar() { # $1: pasta destino com o shared e o dominio no formato do web
  mkdir -p "$1/shared" "$1/dominio"
  cp -r "$api/models/comum/." "$1/shared/"
  cp -r "$api/views/contratos" "$1/shared/contratos"
  cp "$api/views/contrato.ts" "$1/shared/contrato.ts"
  cp -r "$api/dominio/." "$1/dominio/"
  rm -f "$1/dominio/README.md"
}

if [[ "${1:-}" == "--conferir" ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  montar "$tmp"
  diff -r "$tmp/shared" "$web/shared" && diff -r "$tmp/dominio" "$web/dominio"
  echo "shared e dominio do web iguais aos da api"
else
  rm -rf "$web/shared" "$web/dominio"
  montar "$web"
  echo "shared e dominio copiados para o web"
fi
