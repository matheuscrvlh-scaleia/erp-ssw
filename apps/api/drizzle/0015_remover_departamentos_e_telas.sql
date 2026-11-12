-- O vínculo larga o departamento antes de a tabela sair (o CASCADE do DROP já levaria a FK).
ALTER TABLE "erp"."empresa_usuarios" DROP CONSTRAINT "empresa_usuarios_departamento_fk";
--> statement-breakpoint
ALTER TABLE "erp"."cargo_telas" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "erp"."departamento_telas" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "erp"."departamentos" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "erp"."usuario_telas" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "cargo_telas_select" ON "erp"."cargo_telas" CASCADE;--> statement-breakpoint
DROP POLICY "cargo_telas_insert" ON "erp"."cargo_telas" CASCADE;--> statement-breakpoint
DROP POLICY "cargo_telas_update" ON "erp"."cargo_telas" CASCADE;--> statement-breakpoint
DROP POLICY "cargo_telas_delete" ON "erp"."cargo_telas" CASCADE;--> statement-breakpoint
DROP TABLE "erp"."cargo_telas" CASCADE;--> statement-breakpoint
DROP POLICY "departamento_telas_select" ON "erp"."departamento_telas" CASCADE;--> statement-breakpoint
DROP POLICY "departamento_telas_insert" ON "erp"."departamento_telas" CASCADE;--> statement-breakpoint
DROP POLICY "departamento_telas_update" ON "erp"."departamento_telas" CASCADE;--> statement-breakpoint
DROP POLICY "departamento_telas_delete" ON "erp"."departamento_telas" CASCADE;--> statement-breakpoint
DROP TABLE "erp"."departamento_telas" CASCADE;--> statement-breakpoint
DROP POLICY "departamentos_select" ON "erp"."departamentos" CASCADE;--> statement-breakpoint
DROP POLICY "departamentos_insert" ON "erp"."departamentos" CASCADE;--> statement-breakpoint
DROP POLICY "departamentos_update" ON "erp"."departamentos" CASCADE;--> statement-breakpoint
DROP POLICY "departamentos_delete" ON "erp"."departamentos" CASCADE;--> statement-breakpoint
DROP TABLE "erp"."departamentos" CASCADE;--> statement-breakpoint
DROP POLICY "usuario_telas_select" ON "erp"."usuario_telas" CASCADE;--> statement-breakpoint
DROP POLICY "usuario_telas_insert" ON "erp"."usuario_telas" CASCADE;--> statement-breakpoint
DROP POLICY "usuario_telas_update" ON "erp"."usuario_telas" CASCADE;--> statement-breakpoint
DROP POLICY "usuario_telas_delete" ON "erp"."usuario_telas" CASCADE;--> statement-breakpoint
DROP TABLE "erp"."usuario_telas" CASCADE;--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" DROP COLUMN "departamento_chave";--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" DROP COLUMN "setor";