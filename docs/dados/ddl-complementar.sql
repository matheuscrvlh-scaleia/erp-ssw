-- DDL complementar do schema de domínio: o que o Drizzle não expressa.
--
-- Entra como migration customizada (`drizzle-kit generate --custom --name dominio_complementar`)
-- logo depois da migration gerada do domínio. Só índice e parâmetro de armazenamento: nenhuma
-- função, gatilho, view ou extensão.

-- 1. Armazenamento das tabelas quentes (o sistema atual usa os mesmos valores).
--    fillfactor 85: os UPDATEs frequentes de `ctes` (ingestão a cada 30 min) cabem na mesma página
--    (HOT update) e não incham os índices.
--    autovacuum agressivo: mantém o visibility map em dia para os index-only scans abaixo.
ALTER TABLE erp.ctes SET (
  fillfactor = 85,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 0
);
ALTER TABLE erp.ocorrencias SET (
  fillfactor = 85,
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 0
);
ALTER TABLE erp.ingestao_linhas SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.05
);

-- 2. Índices de cobertura das agregações pesadas.

-- Consulta-base das telas: empresa + período de emissão + universo (não fora_universo e filial
-- efetiva própria). A chave resolve período e universo; o INCLUDE traz as colunas que
-- Performance, SLA, Ranking, Ocorrências (contagem por código) e Listagem agregada leem, para a
-- agregação de ~250 mil CT-e sair por index-only scan, sem visitar a tabela.
CREATE INDEX ctes_universo_emissao_cobre_idx
  ON erp.ctes (empresa_id, data_emissao, filial_efetiva)
  INCLUDE (
    id, unidade_id, equipe_id, parceiro_id, pagador_cnpj_digitos, ocorr_efetiva_codigo_num,
    data_entrega_realizada, data_prevista_entrega, data_conclusao_efetiva, prazo_padrao_data,
    no_prazo, responsabilidade_cliente, atraso_dias, tipo_documento, tipo_documento_455,
    valor_frete, peso, volumes
  )
  WHERE NOT fora_universo;

-- Painel de Ocorrências por período da ocorrência: contagens por código, penalizantes e
-- responsável sem ir à tabela de 1,5 mi de linhas.
CREATE INDEX ocorrencias_data_cobre_idx
  ON erp.ocorrencias (empresa_id, data_hora)
  INCLUDE (cte_id, codigo, penaliza, responsavel, quarentena);
