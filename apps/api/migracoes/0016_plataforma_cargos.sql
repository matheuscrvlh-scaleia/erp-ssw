-- Cargos da equipe da Plataforma (Ver / Criar-Editar / Excluir por tela da Plataforma). Quem já é
-- da equipe fica no cargo Super Admin, que tem tudo: ninguém ganha nem perde acesso.
CREATE TABLE "erp"."plataforma_cargo_permissoes" (
	"cargo_chave" text NOT NULL,
	"tela_chave" text NOT NULL,
	"acao" text NOT NULL,
	CONSTRAINT "plataforma_cargo_permissoes_cargo_chave_tela_chave_acao_pk" PRIMARY KEY("cargo_chave","tela_chave","acao"),
	CONSTRAINT "plataforma_cargo_permissoes_acao_valida" CHECK ("erp"."plataforma_cargo_permissoes"."acao" in ('ver', 'editar', 'excluir'))
);

CREATE TABLE "erp"."plataforma_cargos" (
	"chave" text PRIMARY KEY NOT NULL,
	"rotulo" text NOT NULL,
	"protegido" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "erp"."plataforma_cargos" ("chave", "rotulo", "protegido") VALUES ('super_admin', 'Super Admin', true);
ALTER TABLE "erp"."plataforma_admins" ADD COLUMN "cargo" text DEFAULT 'super_admin' NOT NULL;
ALTER TABLE "erp"."plataforma_cargo_permissoes" ADD CONSTRAINT "plataforma_cargo_permissoes_cargo_chave_plataforma_cargos_chave_fk" FOREIGN KEY ("cargo_chave") REFERENCES "erp"."plataforma_cargos"("chave") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "erp"."plataforma_cargo_permissoes" ADD CONSTRAINT "plataforma_cargo_permissoes_tela_chave_telas_chave_fk" FOREIGN KEY ("tela_chave") REFERENCES "erp"."telas"("chave") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."plataforma_admins" ADD CONSTRAINT "plataforma_admins_cargo_plataforma_cargos_chave_fk" FOREIGN KEY ("cargo") REFERENCES "erp"."plataforma_cargos"("chave") ON DELETE no action ON UPDATE cascade;
CREATE INDEX "plataforma_admins_cargo_idx" ON "erp"."plataforma_admins" USING btree ("cargo");
