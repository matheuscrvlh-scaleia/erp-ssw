#!/usr/bin/env bash
# Copia os schemas erp e migracoes do Supabase para o Postgres do docker-compose e confere a
# contagem de linhas de cada tabela nos dois lados. Uso único, na virada (docs/deploy.md §6):
#
#   ORIGEM_URL='postgres://erp_migracao.<projeto>:<senha>@<pooler>:5432/postgres?sslmode=require' \
#     scripts/migrar-do-supabase.sh
#
# Antes: api e worker-ssw parados (sem escrita na origem; senão a contagem diverge). O destino tem
# de estar sem o schema erp: o script não sobrescreve nada. Donos, GRANTs e políticas RLS vêm no
# dump; os papéis já existem no destino (criados na 1ª subida do postgres).
set -euo pipefail

: "${ORIGEM_URL:?defina ORIGEM_URL (papel erp_migracao no Supabase)}"
cd "$(dirname "$0")/.."

psql_destino() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres -XAt "$@"; }
psql_origem() { docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -XAt -d "$ORIGEM_URL" "$@"; }

docker compose up -d --wait postgres

if [ "$(psql_destino -c "select count(*) from pg_namespace where nspname in ('erp','migracoes')")" != 0 ]; then
  echo "O destino já tem o schema erp ou migracoes. Nada foi feito." >&2
  exit 1
fi

echo "== copiando (dump da origem direto no restore, numa transação só)"
inicio=$(date +%s)
docker compose exec -T -e ORIGEM_URL postgres sh -c \
  'set -o pipefail; pg_dump -Fc -n erp -n migracoes -d "$ORIGEM_URL" | pg_restore -U postgres -d postgres --exit-on-error --single-transaction'
echo "copiado em $(( $(date +%s) - inicio )) s"

echo "== analyze"
psql_destino -c "analyze"

# Contagem exata de cada tabela. Origem com erp_migracao: dono das tabelas, então o RLS não filtra.
contar="select n.nspname || '.' || c.relname || ' ' ||
  (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname in ('erp','migracoes') and c.relkind in ('r','p') order by 1"

echo "== conferindo linhas por tabela"
temp=$(mktemp -d)
psql_origem -c "$contar" >"$temp/origem.txt"
psql_destino -c "$contar" >"$temp/destino.txt"
if diff "$temp/origem.txt" "$temp/destino.txt"; then
  echo "OK: $(wc -l <"$temp/destino.txt") tabelas com a mesma contagem nos dois lados."
else
  echo "DIVERGÊNCIA nas linhas acima (< origem, > destino). Não virar." >&2
  exit 1
fi
