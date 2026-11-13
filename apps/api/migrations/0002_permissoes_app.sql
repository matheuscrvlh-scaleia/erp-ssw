-- Permissões do papel da aplicação (erp_app): só DML no schema erp, nunca DDL. O RLS de cada
-- tabela decide as linhas. Tabelas futuras herdam a mesma permissão (default privileges).
GRANT USAGE ON SCHEMA "erp" TO "erp_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "erp" TO "erp_app";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "erp" TO "erp_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "erp" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "erp_app";
ALTER DEFAULT PRIVILEGES IN SCHEMA "erp" GRANT USAGE, SELECT ON SEQUENCES TO "erp_app";
-- Histórico de auditoria é só de inserção (o RLS também não tem política de UPDATE/DELETE).
REVOKE UPDATE, DELETE ON "erp"."auditoria" FROM "erp_app";
-- Catálogos globais: o app lê; quem escreve é o seed, com o papel de migração.
REVOKE INSERT, UPDATE, DELETE ON "erp"."telas", "erp"."modulos", "erp"."modulo_telas" FROM "erp_app";
