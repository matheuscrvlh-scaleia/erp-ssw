CREATE SCHEMA "erp";
--> statement-breakpoint
CREATE TABLE "erp"."cargo_telas" (
	"cargo_chave" text NOT NULL,
	"tela_chave" text NOT NULL,
	CONSTRAINT "cargo_telas_cargo_chave_tela_chave_pk" PRIMARY KEY("cargo_chave","tela_chave")
);
--> statement-breakpoint
CREATE TABLE "erp"."cargos" (
	"chave" text PRIMARY KEY NOT NULL,
	"rotulo" text NOT NULL,
	"protegido" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp"."departamento_telas" (
	"empresa_id" uuid NOT NULL,
	"departamento_chave" text NOT NULL,
	"tela_chave" text NOT NULL,
	CONSTRAINT "departamento_telas_empresa_id_departamento_chave_tela_chave_pk" PRIMARY KEY("empresa_id","departamento_chave","tela_chave")
);
--> statement-breakpoint
ALTER TABLE "erp"."departamento_telas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."departamentos" (
	"empresa_id" uuid NOT NULL,
	"chave" text NOT NULL,
	"rotulo" text NOT NULL,
	"descricao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"protegido" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departamentos_empresa_id_chave_pk" PRIMARY KEY("empresa_id","chave")
);
--> statement-breakpoint
ALTER TABLE "erp"."departamentos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."empresa_usuarios" (
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"papel" text,
	"departamento_chave" text,
	"setor" text,
	"unidade_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	CONSTRAINT "empresa_usuarios_empresa_id_usuario_id_pk" PRIMARY KEY("empresa_id","usuario_id")
);
--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."usuario_telas" (
	"empresa_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tela_chave" text NOT NULL,
	"permitido" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_telas_empresa_id_usuario_id_tela_chave_pk" PRIMARY KEY("empresa_id","usuario_id","tela_chave")
);
--> statement-breakpoint
ALTER TABLE "erp"."usuario_telas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."feriados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"data" date NOT NULL,
	"tipo" text NOT NULL,
	"cidade" text,
	"uf" text,
	"descricao" text NOT NULL,
	"gerado_automaticamente" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feriados_unico" UNIQUE NULLS NOT DISTINCT("data","tipo","cidade","uf","empresa_id"),
	CONSTRAINT "feriados_uf_formato" CHECK ("erp"."feriados"."uf" is null or "erp"."feriados"."uf" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "erp"."feriados" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."unidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cidade" text NOT NULL,
	"uf" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp"."unidades" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."identidades_externas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"provedor" text NOT NULL,
	"sujeito" text NOT NULL,
	"email" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_uso_em" timestamp with time zone,
	CONSTRAINT "identidades_externas_provedor_sujeito" UNIQUE("provedor","sujeito")
);
--> statement-breakpoint
CREATE TABLE "erp"."plataforma_admins" (
	"usuario_id" uuid PRIMARY KEY NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid
);
--> statement-breakpoint
CREATE TABLE "erp"."sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"familia_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"empresa_ativa_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"substituida_em" timestamp with time zone,
	"revogada_em" timestamp with time zone,
	"motivo_revogacao" text,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "sessoes_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "erp"."tokens_senha" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"token_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	CONSTRAINT "tokens_senha_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "erp"."usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nome" text,
	"senha_hash" text,
	"senha_algoritmo" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"tentativas_falhas" integer DEFAULT 0 NOT NULL,
	"bloqueado_ate" timestamp with time zone,
	"ultimo_login_em" timestamp with time zone,
	"empresa_preferida_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email"),
	CONSTRAINT "usuarios_email_normalizado" CHECK ("erp"."usuarios"."email" = lower(btrim("erp"."usuarios"."email"))),
	CONSTRAINT "usuarios_senha_coerente" CHECK (("erp"."usuarios"."senha_hash" is null) = ("erp"."usuarios"."senha_algoritmo" is null))
);
--> statement-breakpoint
CREATE TABLE "erp"."auditoria" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "erp"."auditoria_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"empresa_id" uuid,
	"ator_id" uuid,
	"ator_email" text,
	"ator_tipo" text NOT NULL,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" text,
	"resumo" text,
	"antes" jsonb,
	"depois" jsonb,
	"ip" text,
	"user_agent" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp"."auditoria" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."configuracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"chave" text NOT NULL,
	"valor" text NOT NULL,
	"descricao" text NOT NULL,
	"grupo" text NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	CONSTRAINT "configuracoes_empresa_chave" UNIQUE NULLS NOT DISTINCT("empresa_id","chave")
);
--> statement-breakpoint
ALTER TABLE "erp"."configuracoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."empresa_integracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"ativo" boolean DEFAULT false NOT NULL,
	"parametros" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"segredo_cifrado" text,
	"segredo_versao_chave" integer,
	"segredo_definido_em" timestamp with time zone,
	"ultimo_teste_em" timestamp with time zone,
	"ultimo_teste_ok" boolean,
	"ultimo_teste_msg" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	CONSTRAINT "empresa_integracoes_empresa_tipo" UNIQUE("empresa_id","tipo"),
	CONSTRAINT "empresa_integracoes_segredo_coerente" CHECK (("erp"."empresa_integracoes"."segredo_cifrado" is null) = ("erp"."empresa_integracoes"."segredo_versao_chave" is null))
);
--> statement-breakpoint
ALTER TABLE "erp"."empresa_integracoes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."empresa_modulos" (
	"empresa_id" uuid NOT NULL,
	"modulo_chave" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"inicio" date,
	"fim" date,
	"observacao" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	CONSTRAINT "empresa_modulos_empresa_id_modulo_chave_pk" PRIMARY KEY("empresa_id","modulo_chave"),
	CONSTRAINT "empresa_modulos_vigencia" CHECK ("erp"."empresa_modulos"."inicio" is null or "erp"."empresa_modulos"."fim" is null or "erp"."empresa_modulos"."inicio" <= "erp"."empresa_modulos"."fim")
);
--> statement-breakpoint
ALTER TABLE "erp"."empresa_modulos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"nome_curto" text NOT NULL,
	"razao_social" text,
	"cnpj" text,
	"dominio_ssw" text,
	"logo_caminho" text,
	"cor_primaria" text DEFAULT '#212a63' NOT NULL,
	"cor_destaque" text DEFAULT '#c0392b' NOT NULL,
	"slogan" text,
	"fuso" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"status" text DEFAULT 'implantacao' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_por" uuid,
	CONSTRAINT "empresas_slug_unique" UNIQUE("slug"),
	CONSTRAINT "empresas_slug_formato" CHECK ("erp"."empresas"."slug" ~ '^[a-z0-9][a-z0-9-]*$'),
	CONSTRAINT "empresas_cor_primaria_hex" CHECK ("erp"."empresas"."cor_primaria" ~ '^#[0-9a-fA-F]{6}$'),
	CONSTRAINT "empresas_cor_destaque_hex" CHECK ("erp"."empresas"."cor_destaque" ~ '^#[0-9a-fA-F]{6}$')
);
--> statement-breakpoint
ALTER TABLE "erp"."empresas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "erp"."modulo_telas" (
	"modulo_chave" text NOT NULL,
	"tela_chave" text NOT NULL,
	CONSTRAINT "modulo_telas_modulo_chave_tela_chave_pk" PRIMARY KEY("modulo_chave","tela_chave")
);
--> statement-breakpoint
CREATE TABLE "erp"."modulos" (
	"chave" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"essencial" boolean DEFAULT false NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp"."telas" (
	"chave" text PRIMARY KEY NOT NULL,
	"rotulo" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "erp"."cargo_telas" ADD CONSTRAINT "cargo_telas_cargo_chave_cargos_chave_fk" FOREIGN KEY ("cargo_chave") REFERENCES "erp"."cargos"("chave") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "erp"."cargo_telas" ADD CONSTRAINT "cargo_telas_tela_chave_telas_chave_fk" FOREIGN KEY ("tela_chave") REFERENCES "erp"."telas"("chave") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."departamento_telas" ADD CONSTRAINT "departamento_telas_tela_chave_telas_chave_fk" FOREIGN KEY ("tela_chave") REFERENCES "erp"."telas"("chave") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."departamento_telas" ADD CONSTRAINT "departamento_telas_departamento_fk" FOREIGN KEY ("empresa_id","departamento_chave") REFERENCES "erp"."departamentos"("empresa_id","chave") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "erp"."departamentos" ADD CONSTRAINT "departamentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" ADD CONSTRAINT "empresa_usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" ADD CONSTRAINT "empresa_usuarios_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "erp"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" ADD CONSTRAINT "empresa_usuarios_papel_cargos_chave_fk" FOREIGN KEY ("papel") REFERENCES "erp"."cargos"("chave") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" ADD CONSTRAINT "empresa_usuarios_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_usuarios" ADD CONSTRAINT "empresa_usuarios_departamento_fk" FOREIGN KEY ("empresa_id","departamento_chave") REFERENCES "erp"."departamentos"("empresa_id","chave") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "erp"."usuario_telas" ADD CONSTRAINT "usuario_telas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."usuario_telas" ADD CONSTRAINT "usuario_telas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "erp"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."usuario_telas" ADD CONSTRAINT "usuario_telas_tela_chave_telas_chave_fk" FOREIGN KEY ("tela_chave") REFERENCES "erp"."telas"("chave") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."feriados" ADD CONSTRAINT "feriados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."unidades" ADD CONSTRAINT "unidades_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."identidades_externas" ADD CONSTRAINT "identidades_externas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "erp"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."plataforma_admins" ADD CONSTRAINT "plataforma_admins_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "erp"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."plataforma_admins" ADD CONSTRAINT "plataforma_admins_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."sessoes" ADD CONSTRAINT "sessoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "erp"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."sessoes" ADD CONSTRAINT "sessoes_empresa_ativa_id_empresas_id_fk" FOREIGN KEY ("empresa_ativa_id") REFERENCES "erp"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."tokens_senha" ADD CONSTRAINT "tokens_senha_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "erp"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."tokens_senha" ADD CONSTRAINT "tokens_senha_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."usuarios" ADD CONSTRAINT "usuarios_empresa_preferida_id_empresas_id_fk" FOREIGN KEY ("empresa_preferida_id") REFERENCES "erp"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."auditoria" ADD CONSTRAINT "auditoria_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."auditoria" ADD CONSTRAINT "auditoria_ator_id_usuarios_id_fk" FOREIGN KEY ("ator_id") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."configuracoes" ADD CONSTRAINT "configuracoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."configuracoes" ADD CONSTRAINT "configuracoes_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_integracoes" ADD CONSTRAINT "empresa_integracoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_integracoes" ADD CONSTRAINT "empresa_integracoes_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_modulos" ADD CONSTRAINT "empresa_modulos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_modulos" ADD CONSTRAINT "empresa_modulos_modulo_chave_modulos_chave_fk" FOREIGN KEY ("modulo_chave") REFERENCES "erp"."modulos"("chave") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresa_modulos" ADD CONSTRAINT "empresa_modulos_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresas" ADD CONSTRAINT "empresas_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."empresas" ADD CONSTRAINT "empresas_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "erp"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."modulo_telas" ADD CONSTRAINT "modulo_telas_modulo_chave_modulos_chave_fk" FOREIGN KEY ("modulo_chave") REFERENCES "erp"."modulos"("chave") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "erp"."modulo_telas" ADD CONSTRAINT "modulo_telas_tela_chave_telas_chave_fk" FOREIGN KEY ("tela_chave") REFERENCES "erp"."telas"("chave") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "empresa_usuarios_usuario_idx" ON "erp"."empresa_usuarios" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "feriados_data_idx" ON "erp"."feriados" USING btree ("data");--> statement-breakpoint
CREATE INDEX "sessoes_familia_idx" ON "erp"."sessoes" USING btree ("familia_id");--> statement-breakpoint
CREATE INDEX "sessoes_usuario_idx" ON "erp"."sessoes" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "tokens_senha_usuario_idx" ON "erp"."tokens_senha" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "auditoria_empresa_criado_idx" ON "erp"."auditoria" USING btree ("empresa_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "auditoria_criado_idx" ON "erp"."auditoria" USING btree ("criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE POLICY "departamento_telas_select" ON "erp"."departamento_telas" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."departamento_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "departamento_telas_insert" ON "erp"."departamento_telas" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (("erp"."departamento_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "departamento_telas_update" ON "erp"."departamento_telas" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (("erp"."departamento_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."departamento_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "departamento_telas_delete" ON "erp"."departamento_telas" AS PERMISSIVE FOR DELETE TO "erp_app" USING (("erp"."departamento_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "departamentos_select" ON "erp"."departamentos" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."departamentos"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "departamentos_insert" ON "erp"."departamentos" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (("erp"."departamentos"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "departamentos_update" ON "erp"."departamentos" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (("erp"."departamentos"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."departamentos"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "departamentos_delete" ON "erp"."departamentos" AS PERMISSIVE FOR DELETE TO "erp_app" USING (("erp"."departamentos"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "empresa_usuarios_select" ON "erp"."empresa_usuarios" AS PERMISSIVE FOR SELECT TO "erp_app" USING ((("erp"."empresa_usuarios"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on') or "erp"."empresa_usuarios"."usuario_id" = nullif(current_setting('app.usuario_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "empresa_usuarios_insert" ON "erp"."empresa_usuarios" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (("erp"."empresa_usuarios"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "empresa_usuarios_update" ON "erp"."empresa_usuarios" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (("erp"."empresa_usuarios"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."empresa_usuarios"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "empresa_usuarios_delete" ON "erp"."empresa_usuarios" AS PERMISSIVE FOR DELETE TO "erp_app" USING (("erp"."empresa_usuarios"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "usuario_telas_select" ON "erp"."usuario_telas" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."usuario_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "usuario_telas_insert" ON "erp"."usuario_telas" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (("erp"."usuario_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "usuario_telas_update" ON "erp"."usuario_telas" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (("erp"."usuario_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."usuario_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "usuario_telas_delete" ON "erp"."usuario_telas" AS PERMISSIVE FOR DELETE TO "erp_app" USING (("erp"."usuario_telas"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "feriados_select" ON "erp"."feriados" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."feriados"."empresa_id" is null or "erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid));--> statement-breakpoint
CREATE POLICY "feriados_insert" ON "erp"."feriados" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK ((("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on') or ("erp"."feriados"."empresa_id" is null
        and "erp"."feriados"."tipo" = 'nacional' and "erp"."feriados"."gerado_automaticamente")));--> statement-breakpoint
CREATE POLICY "feriados_update" ON "erp"."feriados" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "feriados_delete" ON "erp"."feriados" AS PERMISSIVE FOR DELETE TO "erp_app" USING (("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "unidades_select" ON "erp"."unidades" AS PERMISSIVE FOR SELECT TO "erp_app" USING ("erp"."unidades"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "unidades_insert" ON "erp"."unidades" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK ("erp"."unidades"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "unidades_update" ON "erp"."unidades" AS PERMISSIVE FOR UPDATE TO "erp_app" USING ("erp"."unidades"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK ("erp"."unidades"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "unidades_delete" ON "erp"."unidades" AS PERMISSIVE FOR DELETE TO "erp_app" USING ("erp"."unidades"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "auditoria_select" ON "erp"."auditoria" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."auditoria"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "auditoria_insert" ON "erp"."auditoria" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK ((("erp"."auditoria"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')
        or ("erp"."auditoria"."empresa_id" is null and "erp"."auditoria"."ator_id" = nullif(current_setting('app.usuario_id', true), '')::uuid)));--> statement-breakpoint
CREATE POLICY "configuracoes_select" ON "erp"."configuracoes" AS PERMISSIVE FOR SELECT TO "erp_app" USING ((("erp"."configuracoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on') or "erp"."configuracoes"."empresa_id" is null));--> statement-breakpoint
CREATE POLICY "configuracoes_insert" ON "erp"."configuracoes" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (("erp"."configuracoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "configuracoes_update" ON "erp"."configuracoes" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (("erp"."configuracoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK (("erp"."configuracoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "configuracoes_delete" ON "erp"."configuracoes" AS PERMISSIVE FOR DELETE TO "erp_app" USING (("erp"."configuracoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "empresa_integracoes_select" ON "erp"."empresa_integracoes" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."empresa_integracoes"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "empresa_integracoes_insert" ON "erp"."empresa_integracoes" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresa_integracoes_update" ON "erp"."empresa_integracoes" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on') WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresa_integracoes_delete" ON "erp"."empresa_integracoes" AS PERMISSIVE FOR DELETE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresa_modulos_select" ON "erp"."empresa_modulos" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."empresa_modulos"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on'));--> statement-breakpoint
CREATE POLICY "empresa_modulos_insert" ON "erp"."empresa_modulos" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresa_modulos_update" ON "erp"."empresa_modulos" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on') WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresa_modulos_delete" ON "erp"."empresa_modulos" AS PERMISSIVE FOR DELETE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresas_select" ON "erp"."empresas" AS PERMISSIVE FOR SELECT TO "erp_app" USING (("erp"."empresas"."id" = nullif(current_setting('app.empresa_id', true), '')::uuid or coalesce(current_setting('app.plataforma', true), 'off') = 'on' or exists (
        select 1 from erp.empresa_usuarios eu
        where eu.empresa_id = "erp"."empresas"."id" and eu.usuario_id = nullif(current_setting('app.usuario_id', true), '')::uuid)));--> statement-breakpoint
CREATE POLICY "empresas_insert" ON "erp"."empresas" AS PERMISSIVE FOR INSERT TO "erp_app" WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresas_update" ON "erp"."empresas" AS PERMISSIVE FOR UPDATE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on') WITH CHECK (coalesce(current_setting('app.plataforma', true), 'off') = 'on');--> statement-breakpoint
CREATE POLICY "empresas_delete" ON "erp"."empresas" AS PERMISSIVE FOR DELETE TO "erp_app" USING (coalesce(current_setting('app.plataforma', true), 'off') = 'on');