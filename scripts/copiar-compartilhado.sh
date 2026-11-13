#!/usr/bin/env bash
# Copia @erp/shared e @erp/domain da api (origem) para o web (ADR 0013).
# Na api, @erp/shared mora em views/contracts, views/contract.ts e models/common (MVC, ADR 0014);
# no web, tudo fica em src/shared. Com --conferir, só compara e sai com erro se houver diferença.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
api="$raiz/apps/api/src"
web="$raiz/apps/web/src"

montar() { # $1: pasta destino com o shared e o dominio no formato do web
  mkdir -p "$1/shared" "$1/domain"
  cp -r "$api/models/common/." "$1/shared/"
  cp -r "$api/views/contracts" "$1/shared/contracts"
  cp "$api/views/contract.ts" "$1/shared/contract.ts"
  cp -r "$api/domain/." "$1/domain/"
  rm -f "$1/domain/README.md"
}

if [[ "${1:-}" == "--conferir" ]]; then
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  montar "$tmp"
  diff -r "$tmp/shared" "$web/shared" && diff -r "$tmp/domain" "$web/domain"
  echo "shared e domain do web iguais aos da api"
else
  rm -rf "$web/shared" "$web/domain"
  montar "$web"
  echo "shared e domain copiados para o web"
fi
