-- O vínculo larga o departamento antes de a tabela sair (o CASCADE do DROP já levaria a FK).
ALTER TABLE "erp"."empresa_usuarios" DROP CONSTRAINT "empresa_usuarios_departamento_fk";

ALTER TABLE "erp"."cargo_telas" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "erp"."departamento_telas" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "erp"."departamentos" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "erp"."usuario_telas" DISABLE ROW LEVEL SECURITY;
DROP POLICY "cargo_telas_select" ON "erp"."cargo_telas" CASCADE;
DROP POLICY "cargo_telas_insert" ON "erp"."cargo_telas" CASCADE;
DROP POLICY "cargo_telas_update" ON "erp"."cargo_telas" CASCADE;
DROP POLICY "cargo_telas_delete" ON "erp"."cargo_telas" CASCADE;
DROP TABLE "erp"."cargo_telas" CASCADE;
DROP POLICY "departamento_telas_select" ON "erp"."departamento_telas" CASCADE;
DROP POLICY "departamento_telas_insert" ON "erp"."departamento_telas" CASCADE;
DROP POLICY "departamento_telas_update" ON "erp"."departamento_telas" CASCADE;
DROP POLICY "departamento_telas_delete" ON "erp"."departamento_telas" CASCADE;
DROP TABLE "erp"."departamento_telas" CASCADE;
DROP POLICY "departamentos_select" ON "erp"."departamentos" CASCADE;
DROP POLICY "departamentos_insert" ON "erp"."departamentos" CASCADE;
DROP POLICY "departamentos_update" ON "erp"."departamentos" CASCADE;
DROP POLICY "departamentos_delete" ON "erp"."departamentos" CASCADE;
DROP TABLE "erp"."departamentos" CASCADE;
DROP POLICY "usuario_telas_select" ON "erp"."usuario_telas" CASCADE;
DROP POLICY "usuario_telas_insert" ON "erp"."usuario_telas" CASCADE;
DROP POLICY "usuario_telas_update" ON "erp"."usuario_telas" CASCADE;
DROP POLICY "usuario_telas_delete" ON "erp"."usuario_telas" CASCADE;
DROP TABLE "erp"."usuario_telas" CASCADE;
ALTER TABLE "erp"."empresa_usuarios" DROP COLUMN "departamento_chave";
ALTER TABLE "erp"."empresa_usuarios" DROP COLUMN "setor";