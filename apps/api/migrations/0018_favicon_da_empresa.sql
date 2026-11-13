-- Favicon da empresa (aba do navegador). Sem favicon, o painel usa o do sistema.
ALTER TABLE "erp"."empresas" ADD COLUMN "favicon_caminho" text;
