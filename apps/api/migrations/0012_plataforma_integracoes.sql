CREATE TABLE "erp"."plataforma_integracoes" (
	"tipo" text PRIMARY KEY NOT NULL,
	"parametros" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"segredo_cifrado" text,
	"segredo_versao_chave" integer,
	"segredo_definido_em" timestamp with time zone,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	CONSTRAINT "plataforma_integracoes_segredo_coerente" CHECK (("erp"."plataforma_integracoes"."segredo_cifrado" is null) = ("erp"."plataforma_integracoes"."segredo_versao_chave" is null))
);

ALTER TABLE "erp"."plataforma_integracoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "erp"."plataforma_integracoes" ADD CONSTRAINT "plataforma_integracoes_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;
CREATE POLICY "plataforma_integracoes_select" ON "erp"."plataforma_integracoes" AS PERMISSIVE FOR SELECT TO "erp_app" USING (true);
CREATE POLICY "plataforma_integracoes_insert" ON "erp"."plataforma_integracoes" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');
CREATE POLICY "plataforma_integracoes_update" ON "erp"."plataforma_integracoes" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on') WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');
CREATE POLICY "plataforma_integracoes_delete" ON "erp"."plataforma_integracoes" AS PERMISSIVE FOR DELETE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on');