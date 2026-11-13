ALTER TABLE "erp"."romaneio_conferente_cte" ADD COLUMN "data_ocorr_ctrc" date;
ALTER TABLE "erp"."romaneio_conferente_cte" ADD COLUMN "hora_ocorr_ctrc" text;
ALTER TABLE "erp"."romaneio_conferente_cte" ADD COLUMN "situacao" text;
ALTER TABLE "erp"."romaneio_conferente_cte" ADD COLUMN "data_emissao" date;
ALTER TABLE "erp"."romaneio_conferente_cte" ADD COLUMN "importado_em" timestamp with time zone;