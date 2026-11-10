CREATE TABLE "erp"."romaneio_conferente_cte" (
	"empresa_id" uuid NOT NULL,
	"sigla" text NOT NULL,
	"numero" text NOT NULL,
	"conferente" text,
	"romaneio" text NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "romaneio_conferente_cte_pk" PRIMARY KEY("empresa_id","sigla","numero")
);
--> statement-breakpoint
ALTER TABLE "erp"."romaneio_conferente_cte" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "erp"."romaneio_conferente_cte" ADD CONSTRAINT "romaneio_conferente_cte_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "romaneio_conferente_cte_conferente_idx" ON "erp"."romaneio_conferente_cte" USING btree ("empresa_id","conferente") WHERE "erp"."romaneio_conferente_cte"."conferente" is not null;--> statement-breakpoint
CREATE INDEX "auditoria_entidade_idx" ON "erp"."auditoria" USING btree ("empresa_id","entidade","entidade_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "romaneio_conferente_cte_select" ON "erp"."romaneio_conferente_cte" AS PERMISSIVE FOR SELECT TO "erp_app" USING ("erp"."romaneio_conferente_cte"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "romaneio_conferente_cte_insert" ON "erp"."romaneio_conferente_cte" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK ("erp"."romaneio_conferente_cte"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "romaneio_conferente_cte_update" ON "erp"."romaneio_conferente_cte" AS PERMISSIVE FOR UPDATE TO "erp_app" USING ("erp"."romaneio_conferente_cte"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK ("erp"."romaneio_conferente_cte"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "romaneio_conferente_cte_delete" ON "erp"."romaneio_conferente_cte" AS PERMISSIVE FOR DELETE TO "erp_app" USING ("erp"."romaneio_conferente_cte"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);