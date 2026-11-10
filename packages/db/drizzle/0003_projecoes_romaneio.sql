DROP INDEX "erp"."romaneio_cte_atual_data_idx";--> statement-breakpoint
CREATE INDEX "ingestao_linhas_relatorio_data_idx" ON "erp"."ingestao_linhas" USING btree ("empresa_id","relatorio","data_referencia");--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" DROP COLUMN "prazo_entrega_038";--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" DROP COLUMN "atraso_038";--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" DROP COLUMN "localizacao";--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" DROP COLUMN "frete_455";--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" DROP COLUMN "peso_455";--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" DROP COLUMN "previsao_455";--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" DROP COLUMN "pagador_455";--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" DROP COLUMN "data";--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" DROP COLUMN "frete_036";--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" DROP COLUMN "unidade_destino_306";--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" DROP COLUMN "setor_destino_306";--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" DROP COLUMN "ocorrencia_mobile_306";--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" DROP COLUMN "ocorrencia_atual_306";
--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" ADD COLUMN "tem_038" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" ADD COLUMN "valor_mercadoria_038" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "erp"."cte_dados_relatorios" ADD COLUMN "valor_mercadoria_455" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" ADD COLUMN "placa_036" text;--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" ADD COLUMN "motorista_036" text;--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" ADD COLUMN "tem_306" boolean NOT NULL;--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" ADD COLUMN "placa_306" text;--> statement-breakpoint
ALTER TABLE "erp"."romaneio_cte_atual" ADD COLUMN "motorista_306" text;