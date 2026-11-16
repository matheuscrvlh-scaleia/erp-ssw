-- O Worker SSW lê o endereço do SSW web em Plataforma › Integrações (tipo 'ssw'), o mesmo para
-- todas as empresas. Só as colunas tipo e parametros, e só essa linha: nada de segredo.
GRANT SELECT ("tipo", "parametros") ON "erp"."plataforma_integracoes" TO "erp_worker";
CREATE POLICY "plataforma_integracoes_select_worker" ON "erp"."plataforma_integracoes" AS PERMISSIVE FOR SELECT TO "erp_worker" USING ("erp"."plataforma_integracoes"."tipo" = 'ssw');
