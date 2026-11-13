ALTER TABLE "erp"."ssw_webhook_eventos" ADD COLUMN "token_sha256" text[];
ALTER TABLE "erp"."empresa_integracoes" ADD COLUMN "segredo_anterior_cifrado" text;
ALTER TABLE "erp"."empresa_integracoes" ADD COLUMN "segredo_anterior_versao_chave" integer;
ALTER TABLE "erp"."empresa_integracoes" ADD CONSTRAINT "empresa_integracoes_segredo_anterior_coerente" CHECK (("erp"."empresa_integracoes"."segredo_anterior_cifrado" is null) = ("erp"."empresa_integracoes"."segredo_anterior_versao_chave" is null));