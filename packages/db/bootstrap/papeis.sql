-- Rodar UMA vez, pelo DBA (papel postgres), antes da primeira migration. Não é migration:
-- cria os papéis de login, e as senhas são definidas à parte (\password), nunca neste arquivo.
--
--   erp_migracao: dono do schema erp; roda as migrations e os seeds de catálogo.
--   erp_app:      papel da API e do worker; SEM BYPASSRLS, só DML nas tabelas do erp.

create role erp_migracao login nobypassrls;
create role erp_app login nobypassrls noinherit;

-- erp_migracao cria o schema erp e o schema drizzle (controle das migrations).
grant create on database postgres to erp_migracao;

-- Depois: \password erp_migracao  e  \password erp_app
