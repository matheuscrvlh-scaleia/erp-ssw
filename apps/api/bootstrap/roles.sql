-- Rodar UMA vez, pelo DBA (papel postgres), antes da primeira migration. Não é migration:
-- cria os papéis de login, e as senhas são definidas à parte (\password), nunca neste arquivo.
--
--   erp_migracao: dono do schema erp; roda as migrations e os seeds de catálogo.
--   erp_app:      papel da API (com os jobs do ERP); SEM BYPASSRLS, só DML nas tabelas do erp.
--   erp_worker:   papel do worker-ssw (ADR 0012); SEM BYPASSRLS, só DML nas tabelas da ingestão
--                 (GRANT na migration 0008_worker_ssw).

create role erp_migracao login nobypassrls;
create role erp_app login nobypassrls noinherit;
create role erp_worker login nobypassrls noinherit;

-- erp_migracao cria o schema erp e o schema migracoes (controle das migrations, `bun run db:migrar`).
grant create on database postgres to erp_migracao;

-- Depois: \password erp_migracao, \password erp_app e \password erp_worker
