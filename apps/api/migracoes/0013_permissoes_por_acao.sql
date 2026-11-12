CREATE TABLE "erp"."cargo_permissoes" (
	"empresa_id" uuid NOT NULL,
	"cargo_chave" text NOT NULL,
	"tela_chave" text NOT NULL,
	"acao" text NOT NULL,
	CONSTRAINT "cargo_permissoes_empresa_id_cargo_chave_tela_chave_acao_pk" PRIMARY KEY("empresa_id","cargo_chave","tela_chave","acao"),
	CONSTRAINT "cargo_permissoes_acao_valida" CHECK ("erp"."cargo_permissoes"."acao" in ('ver', 'editar', 'excluir'))
);

ALTER TABLE "erp"."cargo_permissoes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."usuario_permissoes" (
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tela_chave" text NOT NULL,
	"acao" text NOT NULL,
	"efeito" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	CONSTRAINT "usuario_permissoes_empresa_id_usuario_id_tela_chave_acao_pk" PRIMARY KEY("empresa_id","usuario_id","tela_chave","acao"),
	CONSTRAINT "usuario_permissoes_acao_valida" CHECK ("erp"."usuario_permissoes"."acao" in ('ver', 'editar', 'excluir')),
	CONSTRAINT "usuario_permissoes_efeito_valido" CHECK ("erp"."usuario_permissoes"."efeito" in ('concede', 'nega'))
);

ALTER TABLE "erp"."usuario_permissoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "erp"."cargo_permissoes" ADD CONSTRAINT "cargo_permissoes_tela_chave_telas_chave_fk" FOREIGN KEY ("tela_chave") REFERENCES "erp"."telas"("chave") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."cargo_permissoes" ADD CONSTRAINT "cargo_permissoes_cargo_fk" FOREIGN KEY ("empresa_id","cargo_chave") REFERENCES "erp"."cargos"("empresa_id","chave") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "erp"."usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_tela_chave_telas_chave_fk" FOREIGN KEY ("tela_chave") REFERENCES "erp"."telas"("chave") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "erp"."usuarios"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_vinculo_fk" FOREIGN KEY ("empresa_id","usuario_id") REFERENCES "erp"."empresa_usuarios"("empresa_id","usuario_id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "usuario_permissoes_criado_por_idx" ON "erp"."usuario_permissoes" USING btree ("criado_por");
CREATE POLICY "cargo_permissoes_select" ON "erp"."cargo_permissoes" AS PERMISSIVE FOR SELECT TO "erp_app", "erp_worker" USING (("erp"."cargo_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "cargo_permissoes_insert" ON "erp"."cargo_permissoes" AS PERMISSIVE FOR INSERT TO "erp_app", "erp_worker" WITH CHECK (("erp"."cargo_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "cargo_permissoes_update" ON "erp"."cargo_permissoes" AS PERMISSIVE FOR UPDATE TO "erp_app", "erp_worker" USING (("erp"."cargo_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."cargo_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "cargo_permissoes_delete" ON "erp"."cargo_permissoes" AS PERMISSIVE FOR DELETE TO "erp_app", "erp_worker" USING (("erp"."cargo_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "usuario_permissoes_select" ON "erp"."usuario_permissoes" AS PERMISSIVE FOR SELECT TO "erp_app", "erp_worker" USING (("erp"."usuario_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "usuario_permissoes_insert" ON "erp"."usuario_permissoes" AS PERMISSIVE FOR INSERT TO "erp_app", "erp_worker" WITH CHECK (("erp"."usuario_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "usuario_permissoes_update" ON "erp"."usuario_permissoes" AS PERMISSIVE FOR UPDATE TO "erp_app", "erp_worker" USING (("erp"."usuario_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."usuario_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "usuario_permissoes_delete" ON "erp"."usuario_permissoes" AS PERMISSIVE FOR DELETE TO "erp_app", "erp_worker" USING (("erp"."usuario_permissoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));