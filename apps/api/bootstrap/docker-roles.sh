#!/bin/sh
# Roda só no Postgres do docker-compose, uma vez, quando o volume está vazio
# (/docker-entrypoint-initdb.d). Cria os papéis de roles.sql e põe as senhas do .env. As senhas vão
# como variáveis do psql (:'senha'), então aspas ou símbolos nelas não quebram o SQL.
set -eu

psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /bootstrap/roles.sql
psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -v migracao="$ERP_MIGRACAO_SENHA" -v app="$ERP_APP_SENHA" -v worker="$ERP_WORKER_SENHA" <<'SQL'
alter role erp_migracao password :'migracao';
alter role erp_app password :'app';
alter role erp_worker password :'worker';
SQL
