-- PRÉVIA gerada por drizzle-kit 0.31 a partir de packages/db/src/schema/dominio (não é migration).
-- A migration de verdade é gerada pela config da fundação depois do merge; esta prévia é só
-- para revisão do DDL (tabelas, índices, FKs e políticas RLS). Complemento: ddl-complementar.sql.

CREATE TYPE "erp"."tipo_anotacao" AS ENUM('clima', 'feriado', 'operacional', 'outro');
CREATE TYPE "erp"."bonificacao_efeito" AS ENUM('penaliza', 'sac', 'verificar');
CREATE TYPE "erp"."processo_ssw" AS ENUM('ENTREGA', 'DEVOLUCAO', 'REENTREGA', 'AGENDAMENTO', 'COLETA', 'BALSA', 'OPERACIONAL', 'GERAL', 'FINALIZADORA', 'INDENIZACAO');
CREATE TYPE "erp"."responsavel_ocorrencia" AS ENUM('FR', 'transportador', 'destinatario', 'cliente', 'sistema', 'outro');
CREATE TYPE "erp"."tipo_ssw" AS ENUM('ENTREGA', 'PRE_ENTREGA', 'INFORMATIVA', 'PENDENCIA_CLIENTE', 'PENDENCIA_TRANSPORTADORA', 'BAIXA');
CREATE TYPE "erp"."prazo_origem" AS ENUM('proprio', 'parceiro');
CREATE TYPE "erp"."tipo_feriado" AS ENUM('nacional', 'municipal', 'estadual');
CREATE TYPE "erp"."tipo_meta" AS ENUM('taxa_retorno', 'performance_entrega');
CREATE TABLE "erp"."anotacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"data" date NOT NULL,
	"unidade_id" uuid,
	"tipo" "erp"."tipo_anotacao" NOT NULL,
	"texto" text NOT NULL,
	"autor_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "erp"."anotacoes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."bi2_bruto" (
	"empresa_id" uuid NOT NULL,
	"numero" text NOT NULL,
	"codigo_relatorio" text NOT NULL,
	"data_alvo" date NOT NULL,
	"payload" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bi2_bruto_pk" PRIMARY KEY("empresa_id","numero","codigo_relatorio")
);

ALTER TABLE "erp"."bi2_bruto" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."bi2_sincronizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"codigo_relatorio" text NOT NULL,
	"data_alvo" date NOT NULL,
	"data_fechamento_ssw" date,
	"modo" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'ok' NOT NULL,
	"total_linhas" integer DEFAULT 0 NOT NULL,
	"criados" integer DEFAULT 0 NOT NULL,
	"atualizados" integer DEFAULT 0 NOT NULL,
	"erro" text,
	"iniciado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizado_em" timestamp with time zone
);

ALTER TABLE "erp"."bi2_sincronizacoes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."bonificacao_codigos" (
	"empresa_id" uuid NOT NULL,
	"codigo" smallint NOT NULL,
	"efeito" "erp"."bonificacao_efeito" NOT NULL,
	"observacao" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonificacao_codigos_pk" PRIMARY KEY("empresa_id","codigo"),
	CONSTRAINT "bonificacao_codigos_codigo_ck" CHECK ("erp"."bonificacao_codigos"."codigo" between 0 and 99)
);

ALTER TABLE "erp"."bonificacao_codigos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."bonificacao_faltas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"colaborador_nome" text NOT NULL,
	"data_falta" date NOT NULL,
	"tipo" text NOT NULL,
	"observacao" text,
	"registrado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonificacao_faltas_pessoa_dia_uq" UNIQUE("empresa_id","colaborador_nome","data_falta"),
	CONSTRAINT "bonificacao_faltas_tipo_ck" CHECK ("erp"."bonificacao_faltas"."tipo" in ('falta_injustificada', 'dois_dias_abaixo_minimo', 'outro'))
);

ALTER TABLE "erp"."bonificacao_faltas" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."bonificacao_parametros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"taxa_turbo" numeric(10, 4) NOT NULL,
	"taxa_acelerado" numeric(10, 4) NOT NULL,
	"taxa_em_rota_grande" numeric(10, 4) NOT NULL,
	"taxa_em_rota_pequena" numeric(10, 4) NOT NULL,
	"meta_rota_pequena" numeric(5, 4) NOT NULL,
	"meta_rota_grande" numeric(5, 4) NOT NULL,
	"meta_em_rota" numeric(5, 4) NOT NULL,
	"limite_nfs_rota_pequena" integer DEFAULT 15 NOT NULL,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonificacao_parametros_vigencia_ck" CHECK ("erp"."bonificacao_parametros"."vigencia_fim" is null or "erp"."bonificacao_parametros"."vigencia_fim" >= "erp"."bonificacao_parametros"."vigencia_inicio")
);

ALTER TABLE "erp"."bonificacao_parametros" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."bonificacao_regra_criterios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"regra_id" uuid NOT NULL,
	"criterio" text NOT NULL,
	"parametros" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonificacao_regra_criterios_criterio_ck" CHECK ("erp"."bonificacao_regra_criterios"."criterio" in ('entregas_prazo', 'penalizante', 'meta_produtividade', 'piso_performance', 'livre'))
);

ALTER TABLE "erp"."bonificacao_regra_criterios" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."bonificacao_regras" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bonificacao_regras_vigencia_ck" CHECK ("erp"."bonificacao_regras"."vigencia_fim" is null or "erp"."bonificacao_regras"."vigencia_fim" >= "erp"."bonificacao_regras"."vigencia_inicio")
);

ALTER TABLE "erp"."bonificacao_regras" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."codigos_ocorrencia" (
	"empresa_id" uuid NOT NULL,
	"codigo" smallint NOT NULL,
	"descricao" text NOT NULL,
	"tipo_ssw" "erp"."tipo_ssw",
	"processo_ssw" "erp"."processo_ssw",
	"tipo_ssw_manual" boolean DEFAULT false NOT NULL,
	"responsavel" "erp"."responsavel_ocorrencia" NOT NULL,
	"letra_responsavel" char(1),
	"penaliza" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"pendente_classificacao" boolean DEFAULT false NOT NULL,
	"pendencia_acompanhada" boolean DEFAULT false NOT NULL,
	"notas" text,
	"atualizado_por" uuid,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codigos_ocorrencia_pk" PRIMARY KEY("empresa_id","codigo"),
	CONSTRAINT "codigos_ocorrencia_codigo_ck" CHECK ("erp"."codigos_ocorrencia"."codigo" between 0 and 99)
);

ALTER TABLE "erp"."codigos_ocorrencia" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."coletas" (
	"empresa_id" uuid NOT NULL,
	"unidade" text NOT NULL,
	"numero" integer NOT NULL,
	"tipo" text DEFAULT 'NORMAL' NOT NULL,
	"remetente_cnpj" text,
	"remetente_nome" text,
	"remetente_cidade" text,
	"setor" text,
	"destinatario_cnpj" text,
	"destinatario_nome" text,
	"destino_cidade" text,
	"solicitante" text,
	"motorista" text,
	"placa" text,
	"situacao" text,
	"etapa" text NOT NULL,
	"situacao_em" timestamp with time zone,
	"limite_em" timestamp with time zone,
	"limite_inicial" date,
	"cadastrada_em" timestamp with time zone,
	"cadastrada_por" text,
	"dia_cadastro" date,
	"comandada_em" timestamp with time zone,
	"coletada_em" timestamp with time zone,
	"cancelada_em" timestamp with time zone,
	"valor_mercadoria" numeric(14, 2),
	"volumes" integer,
	"peso_kg" numeric(12, 3),
	"mercadoria" text,
	"tipo_frete" text,
	"notas_fiscais" text,
	"observacao" text,
	"cte_sigla" text,
	"cte_numero" text,
	"romaneio" text,
	"prejudicada_horario" boolean DEFAULT false NOT NULL,
	"historico" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"relatorio_emitido_em" timestamp with time zone NOT NULL,
	"arquivo_origem" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coletas_pk" PRIMARY KEY("empresa_id","unidade","numero"),
	CONSTRAINT "coletas_etapa_ck" CHECK ("erp"."coletas"."etapa" in ('cadastrada', 'comandada', 'coletada', 'cancelada'))
);

ALTER TABLE "erp"."coletas" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."cte_prazo_historico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cte_id" uuid NOT NULL,
	"data_anterior" date,
	"data_nova" date,
	"fonte" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "erp"."cte_prazo_historico" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ctes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sigla" text NOT NULL,
	"numero" text NOT NULL,
	"chave" text,
	"sigla_cte" text,
	"numero_cte" bigint,
	"tipo_documento" text,
	"tipo_documento_455" text,
	"duplicado_de" uuid,
	"data_emissao" date NOT NULL,
	"data_embarque" date,
	"data_entrega_realizada" timestamp with time zone,
	"data_conclusao_efetiva" date,
	"unidade_id" uuid,
	"parceiro_id" uuid,
	"equipe_id" uuid,
	"remetente" text,
	"cnpj_remetente" text,
	"destinatario" text,
	"cnpj_destinatario" text,
	"pagador_nome" text,
	"pagador_cnpj" text,
	"pagador_cnpj_digitos" text,
	"parceiro_cnpj" text,
	"parceiro_nome" text,
	"cidade_destino" text,
	"uf_destino" text,
	"bairro_destino" text,
	"logradouro_destino" text,
	"numero_endereco_destino" text,
	"complemento_destino" text,
	"cep_destinatario" text,
	"setor" text,
	"setor_destino" text,
	"filial" text,
	"unidade_origem" text,
	"unidade_destino" text,
	"unidade_atual" text,
	"localizacao_atual" text,
	"filial_efetiva" text,
	"unidade_cidade" text,
	"unidade_uf" text,
	"chave_nfe" text,
	"numero_nf" integer,
	"serie_nf" text,
	"peso" numeric(12, 3),
	"volumes" integer,
	"valor_frete" numeric(14, 2),
	"valor_mercadoria" numeric(14, 2),
	"tde" numeric(14, 2),
	"nro_manifesto" text,
	"primeiro_manifesto" text,
	"ultimo_manifesto" text,
	"prazo_entrega" date,
	"prazo_origem" "erp"."prazo_origem" DEFAULT 'proprio' NOT NULL,
	"prazo_contratado_dias" integer,
	"prazo_fonte" text,
	"data_base_prazo" timestamp with time zone,
	"data_prevista_entrega" date,
	"prazo_padrao_dias" smallint,
	"prazo_padrao_data" date,
	"performance_dias" integer,
	"no_prazo" boolean,
	"responsabilidade_cliente" boolean,
	"fonte_performance" text,
	"atraso_dias" integer,
	"status_atual" text,
	"motorista_nome" text,
	"ajudante_nome" text,
	"placa_coleta" text,
	"placa_entrega" text,
	"comprovante_escaneado" boolean,
	"comprovante_escaneado_em" timestamp with time zone,
	"ultima_ocorr_codigo_0013" text,
	"ultima_ocorr_data_0013" timestamp with time zone,
	"ult_ocorr_codigo_0174" text,
	"ult_ocorr_descricao_0174" text,
	"ult_ocorr_data_0174" timestamp with time zone,
	"ult_ocorr_local_0174" text,
	"ult_ocorr_instrucao_0174" text,
	"ocorr_036_codigo" text,
	"ocorr_036_descricao" text,
	"ocorr_036_data" timestamp with time zone,
	"ocorr_efetiva_codigo" text,
	"ocorr_efetiva_codigo_num" smallint,
	"ocorr_efetiva_descricao" text,
	"ocorr_efetiva_data" timestamp with time zone,
	"ocorr_efetiva_fonte" text,
	"ocorr_efetiva_local" text,
	"cancelado_mesmo_dia" boolean DEFAULT false NOT NULL,
	"fora_universo" boolean DEFAULT false NOT NULL,
	"campos_ssw" text[] DEFAULT '{}'::text[] NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ctes_numero_digitos_ck" CHECK ("erp"."ctes"."numero" ~ '^[1-9][0-9]*$'),
	CONSTRAINT "ctes_sigla_maiuscula_ck" CHECK ("erp"."ctes"."sigla" ~ '^[A-Z]+$'),
	CONSTRAINT "ctes_prazo_padrao_dias_ck" CHECK ("erp"."ctes"."prazo_padrao_dias" is null or "erp"."ctes"."prazo_padrao_dias" >= 0),
	CONSTRAINT "ctes_prazo_fonte_ck" CHECK ("erp"."ctes"."prazo_fonte" is null or "erp"."ctes"."prazo_fonte" in ('xml_dprog', 'consulta_prazo_oc80', 'consulta_prazo_emissao', 'regra_parceiro', 'regra_transbordo', 'regra_unidade', 'fora_malha', 'bi2', 'ssw_manual', 'ssw_038'))
);

ALTER TABLE "erp"."ctes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."equipe_membros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"equipe_id" uuid NOT NULL,
	"usuario_id" uuid,
	"nome" text NOT NULL,
	"papel" text NOT NULL,
	"cpf" text,
	"posicao" smallint,
	"data_saida" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "equipe_membros_papel_ck" CHECK ("erp"."equipe_membros"."papel" in ('motorista', 'ajudante')),
	CONSTRAINT "equipe_membros_posicao_ck" CHECK (("erp"."equipe_membros"."papel" = 'ajudante' and "erp"."equipe_membros"."posicao" between 1 and 3)
        or ("erp"."equipe_membros"."papel" <> 'ajudante' and ("erp"."equipe_membros"."posicao" is null or "erp"."equipe_membros"."posicao" = 0)))
);

ALTER TABLE "erp"."equipe_membros" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."equipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"unidade_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"token_publico_hash" text,
	"token_publico_revogado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "erp"."equipes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."feriados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid,
	"data" date NOT NULL,
	"tipo" "erp"."tipo_feriado" NOT NULL,
	"cidade" text,
	"uf" text,
	"descricao" text NOT NULL,
	"gerado_automaticamente" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feriados_escopo_uq" UNIQUE NULLS NOT DISTINCT("data","tipo","cidade","uf","empresa_id")
);

ALTER TABLE "erp"."feriados" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."filiais" (
	"empresa_id" uuid NOT NULL,
	"sigla" text NOT NULL,
	"tipo" text NOT NULL,
	"nome" text NOT NULL,
	"razao_social" text,
	"cnpj" text,
	"cidade" text,
	"uf" text,
	"propria" boolean DEFAULT false NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filiais_pk" PRIMARY KEY("empresa_id","sigla"),
	CONSTRAINT "filiais_sigla_maiuscula" CHECK ("erp"."filiais"."sigla" = upper(btrim("erp"."filiais"."sigla")) and "erp"."filiais"."sigla" <> '')
);

ALTER TABLE "erp"."filiais" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."filiais_apelidos" (
	"empresa_id" uuid NOT NULL,
	"cidade_normalizada" text NOT NULL,
	"filial" text NOT NULL,
	CONSTRAINT "filiais_apelidos_pk" PRIMARY KEY("empresa_id","cidade_normalizada")
);

ALTER TABLE "erp"."filiais_apelidos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."unidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cidade" text NOT NULL,
	"uf" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "erp"."unidades" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ingestao_aplicacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"aplicado_por" uuid,
	"status" text DEFAULT 'em_andamento' NOT NULL,
	"simulacao" boolean NOT NULL,
	"total_inseridos" integer DEFAULT 0 NOT NULL,
	"total_atualizados" integer DEFAULT 0 NOT NULL,
	"total_ocorrencias" integer DEFAULT 0 NOT NULL,
	"total_ignorados" integer DEFAULT 0 NOT NULL,
	"detalhe" jsonb,
	"erro" text,
	"iniciado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizado_em" timestamp with time zone,
	CONSTRAINT "ingestao_aplicacoes_status_ck" CHECK ("erp"."ingestao_aplicacoes"."status" in ('em_andamento', 'concluido', 'erro'))
);

ALTER TABLE "erp"."ingestao_aplicacoes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ingestao_arquivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome_arquivo" text NOT NULL,
	"ciclo_chave" text,
	"relatorio" text,
	"unidade" text,
	"tamanho" bigint DEFAULT 0 NOT NULL,
	"mtime" bigint DEFAULT 0 NOT NULL,
	"sha256" text,
	"status" text DEFAULT 'observado' NOT NULL,
	"linhas" integer DEFAULT 0 NOT NULL,
	"mensagem" text,
	"lote_id" uuid,
	"visto_em" timestamp with time zone DEFAULT now() NOT NULL,
	"importado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "erp"."ingestao_arquivos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ingestao_ciclos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"ciclo_chave" text NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"motivo" text,
	"faltantes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"totais" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"arquivos_importados" integer DEFAULT 0 NOT NULL,
	"linhas_importadas" integer DEFAULT 0 NOT NULL,
	"primeiro_arquivo_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_arquivo_em" timestamp with time zone DEFAULT now() NOT NULL,
	"fechado_em" timestamp with time zone,
	"aplicado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "erp"."ingestao_ciclos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ingestao_erros" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "erp"."ingestao_erros_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"empresa_id" uuid NOT NULL,
	"relatorio" text NOT NULL,
	"lote_id" uuid NOT NULL,
	"etapa" text NOT NULL,
	"arquivo_origem" text,
	"numero_linha" integer,
	"linha_bruta" text,
	"motivo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestao_erros_etapa_ck" CHECK ("erp"."ingestao_erros"."etapa" in ('analise', 'gravacao'))
);

ALTER TABLE "erp"."ingestao_erros" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ingestao_linhas" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "erp"."ingestao_linhas_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"empresa_id" uuid NOT NULL,
	"relatorio" text NOT NULL,
	"lote_id" uuid NOT NULL,
	"arquivo_id" uuid,
	"numero_linha" integer,
	"hash" text NOT NULL,
	"sigla" text,
	"numero" text,
	"data_referencia" timestamp with time zone,
	"dados" jsonb NOT NULL,
	"importado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"aplicado_em" timestamp with time zone
);

ALTER TABLE "erp"."ingestao_linhas" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ingestao_relatorios_esperados" (
	"empresa_id" uuid NOT NULL,
	"relatorio" text NOT NULL,
	"descricao" text DEFAULT '' NOT NULL,
	"por_unidade" boolean DEFAULT false NOT NULL,
	"unidades_esperadas" text[] DEFAULT '{}'::text[] NOT NULL,
	"obrigatorio_no_ciclo" boolean DEFAULT true NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingestao_relatorios_esperados_pk" PRIMARY KEY("empresa_id","relatorio")
);

ALTER TABLE "erp"."ingestao_relatorios_esperados" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."metas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"unidade_id" uuid,
	"tipo_meta" "erp"."tipo_meta" NOT NULL,
	"valor" numeric(8, 4) NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metas_vigencia_ck" CHECK ("erp"."metas"."vigencia_fim" is null or "erp"."metas"."vigencia_fim" >= "erp"."metas"."vigencia_inicio")
);

ALTER TABLE "erp"."metas" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ocorrencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"cte_id" uuid NOT NULL,
	"codigo" smallint NOT NULL,
	"descricao" text,
	"complemento" text,
	"data_hora" timestamp with time zone NOT NULL,
	"filial" text,
	"protocolo_ssw" text,
	"origem" text DEFAULT 'manual' NOT NULL,
	"responsavel" "erp"."responsavel_ocorrencia" NOT NULL,
	"penaliza" boolean DEFAULT false NOT NULL,
	"quarentena" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ocorrencias_cte_codigo_data_uq" UNIQUE("cte_id","codigo","data_hora")
);

ALTER TABLE "erp"."ocorrencias" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."parceiros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"usa_ssw" boolean DEFAULT false NOT NULL,
	"prazo_acordo_horas" integer DEFAULT 48 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "erp"."parceiros" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."prazos_configurados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"unidade_codigo" text,
	"unidade_destino_codigo" text,
	"parceiro_cnpj" text,
	"parceiro_nome" text,
	"prazo_horas" integer,
	"prazo_dias" integer,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prazos_configurados_tipo_ck" CHECK ("erp"."prazos_configurados"."tipo" in ('unidade', 'parceiro', 'transbordo')),
	CONSTRAINT "prazos_configurados_campos_ck" CHECK (("erp"."prazos_configurados"."tipo" = 'unidade' and "erp"."prazos_configurados"."unidade_codigo" is not null and "erp"."prazos_configurados"."prazo_horas" is not null)
        or ("erp"."prazos_configurados"."tipo" = 'parceiro' and "erp"."prazos_configurados"."parceiro_cnpj" is not null and "erp"."prazos_configurados"."prazo_dias" is not null)
        or ("erp"."prazos_configurados"."tipo" = 'transbordo' and "erp"."prazos_configurados"."unidade_codigo" is not null
            and "erp"."prazos_configurados"."unidade_destino_codigo" is not null and "erp"."prazos_configurados"."prazo_dias" is not null))
);

ALTER TABLE "erp"."prazos_configurados" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."cte_dados_relatorios" (
	"empresa_id" uuid NOT NULL,
	"sigla" text NOT NULL,
	"numero" text NOT NULL,
	"setor" text,
	"bairro" text,
	"endereco" text,
	"cep" text,
	"prazo_entrega_038" date,
	"atraso_038" integer,
	"localizacao" text,
	"valor_mercadoria" numeric(14, 2),
	"frete_455" numeric(14, 2),
	"peso_455" numeric(12, 3),
	"previsao_455" date,
	"pagador_455" text,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cte_dados_relatorios_pk" PRIMARY KEY("empresa_id","sigla","numero")
);

ALTER TABLE "erp"."cte_dados_relatorios" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."romaneio_cte_atual" (
	"empresa_id" uuid NOT NULL,
	"sigla" text NOT NULL,
	"numero" text NOT NULL,
	"tem_036" boolean NOT NULL,
	"placa" text,
	"motorista" text,
	"data" date,
	"romaneio" text,
	"situacao" text,
	"ajudante" text,
	"ajudante_2" text,
	"ajudante_3" text,
	"cod_ocorr_036" text,
	"desc_ocorr_036" text,
	"data_ocorr_036" timestamp with time zone,
	"data_emissao_036" date,
	"frete_036" numeric(14, 2),
	"unidade_destino_306" text,
	"setor_destino_306" text,
	"ocorrencia_mobile_306" text,
	"ocorrencia_atual_306" text,
	"data_306" date,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "romaneio_cte_atual_pk" PRIMARY KEY("empresa_id","sigla","numero")
);

ALTER TABLE "erp"."romaneio_cte_atual" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."romaneio_saidas_cte" (
	"empresa_id" uuid NOT NULL,
	"sigla" text NOT NULL,
	"numero" text NOT NULL,
	"data_saida" date NOT NULL,
	CONSTRAINT "romaneio_saidas_cte_pk" PRIMARY KEY("empresa_id","sigla","numero","data_saida")
);

ALTER TABLE "erp"."romaneio_saidas_cte" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."romaneio_viagens_cte" (
	"empresa_id" uuid NOT NULL,
	"sigla" text NOT NULL,
	"numero" text NOT NULL,
	"romaneio" text NOT NULL,
	"situacao" text,
	"data_saida" date NOT NULL,
	"hora_saida" text,
	"placa" text,
	"motorista" text,
	"motorista_normalizado" text,
	"ajudante" text,
	"ajudante_2" text,
	"ajudante_3" text,
	"primeira" boolean NOT NULL,
	"ultima" boolean NOT NULL,
	"proxima_saida" date,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "romaneio_viagens_cte_pk" PRIMARY KEY("empresa_id","sigla","numero","romaneio")
);

ALTER TABLE "erp"."romaneio_viagens_cte" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ssw_sincronizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"modo" text NOT NULL,
	"status" text NOT NULL,
	"disparado_por" text DEFAULT 'agendamento' NOT NULL,
	"executado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizado_em" timestamp with time zone,
	"ctes_processados" integer DEFAULT 0 NOT NULL,
	"ocorrencias_processadas" integer DEFAULT 0 NOT NULL,
	"duracao_ms" integer DEFAULT 0 NOT NULL,
	"mensagem" text,
	"erros" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "ssw_sincronizacoes_modo_ck" CHECK ("erp"."ssw_sincronizacoes"."modo" in ('historico', 'delta')),
	CONSTRAINT "ssw_sincronizacoes_status_ck" CHECK ("erp"."ssw_sincronizacoes"."status" in ('ok', 'erro', 'parcial', 'em_andamento')),
	CONSTRAINT "ssw_sincronizacoes_disparado_ck" CHECK ("erp"."ssw_sincronizacoes"."disparado_por" in ('agendamento', 'manual', 'api'))
);

ALTER TABLE "erp"."ssw_sincronizacoes" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."ssw_webhook_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"autenticado" boolean DEFAULT false NOT NULL,
	"motivo_rejeicao" text,
	"status_http" smallint NOT NULL,
	"payload_bruto" jsonb,
	"cte_id" uuid,
	"ocorrencia_id" uuid,
	"erro_processamento" text
);

ALTER TABLE "erp"."ssw_webhook_eventos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."xml_cte_arquivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome_arquivo" text NOT NULL,
	"sha256" text NOT NULL,
	"tipo" text NOT NULL,
	"status" text NOT NULL,
	"erro_mensagem" text,
	"ctes_processados" integer DEFAULT 0 NOT NULL,
	"cancelamentos" integer DEFAULT 0 NOT NULL,
	"xmls_pulados" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xml_cte_arquivos_tipo_ck" CHECK ("erp"."xml_cte_arquivos"."tipo" in ('zip', 'xml')),
	CONSTRAINT "xml_cte_arquivos_status_ck" CHECK ("erp"."xml_cte_arquivos"."status" in ('sucesso', 'erro', 'parcial', 'duplicado'))
);

ALTER TABLE "erp"."xml_cte_arquivos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."xml_cte_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"arquivo_id" uuid,
	"sha256_xml" text NOT NULL,
	"nome_xml" text NOT NULL,
	"tipo" text NOT NULL,
	"status" text NOT NULL,
	"numero_cte" text,
	"chave_cte" text,
	"erro_mensagem" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xml_cte_itens_tipo_ck" CHECK ("erp"."xml_cte_itens"."tipo" in ('cte', 'can', 'unknown')),
	CONSTRAINT "xml_cte_itens_status_ck" CHECK ("erp"."xml_cte_itens"."status" in ('sucesso', 'erro', 'orfao'))
);

ALTER TABLE "erp"."xml_cte_itens" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."xml_cte_orfaos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"sha256_xml" text NOT NULL,
	"nome_xml" text NOT NULL,
	"tipo" text NOT NULL,
	"chave_cte" text,
	"numero_cte" text,
	"xml_conteudo" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"ultima_tentativa" timestamp with time zone,
	"ultimo_erro" text,
	"casado_em" timestamp with time zone,
	"expira_em" timestamp with time zone NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xml_cte_orfaos_tipo_ck" CHECK ("erp"."xml_cte_orfaos"."tipo" in ('cte', 'can')),
	CONSTRAINT "xml_cte_orfaos_status_ck" CHECK ("erp"."xml_cte_orfaos"."status" in ('pendente', 'casado', 'expirado'))
);

ALTER TABLE "erp"."xml_cte_orfaos" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "erp"."xml_ftp_sincronizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"executado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"finalizado_em" timestamp with time zone,
	"status" text NOT NULL,
	"disparado_por" text DEFAULT 'agendamento' NOT NULL,
	"arquivos_processados" integer DEFAULT 0 NOT NULL,
	"arquivos_removidos" integer DEFAULT 0 NOT NULL,
	"arquivos_movidos" integer DEFAULT 0 NOT NULL,
	"pastas_limpas" integer DEFAULT 0 NOT NULL,
	"arquivos_com_erro" integer DEFAULT 0 NOT NULL,
	"ctes_processados" integer DEFAULT 0 NOT NULL,
	"duracao_ms" integer DEFAULT 0 NOT NULL,
	"mensagem" text,
	"erros" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "xml_ftp_sincronizacoes_status_ck" CHECK ("erp"."xml_ftp_sincronizacoes"."status" in ('ok', 'parcial', 'erro', 'pausado')),
	CONSTRAINT "xml_ftp_sincronizacoes_disparado_ck" CHECK ("erp"."xml_ftp_sincronizacoes"."disparado_por" in ('agendamento', 'manual'))
);

ALTER TABLE "erp"."xml_ftp_sincronizacoes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "erp"."anotacoes" ADD CONSTRAINT "anotacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."anotacoes" ADD CONSTRAINT "anotacoes_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "erp"."unidades"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."anotacoes" ADD CONSTRAINT "anotacoes_autor_id_usuarios_id_fk" FOREIGN KEY ("autor_id") REFERENCES "erp"."usuarios"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."bi2_bruto" ADD CONSTRAINT "bi2_bruto_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."bi2_sincronizacoes" ADD CONSTRAINT "bi2_sincronizacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_codigos" ADD CONSTRAINT "bonificacao_codigos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_faltas" ADD CONSTRAINT "bonificacao_faltas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_faltas" ADD CONSTRAINT "bonificacao_faltas_registrado_por_usuarios_id_fk" FOREIGN KEY ("registrado_por") REFERENCES "erp"."usuarios"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_parametros" ADD CONSTRAINT "bonificacao_parametros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_parametros" ADD CONSTRAINT "bonificacao_parametros_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "erp"."usuarios"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_regra_criterios" ADD CONSTRAINT "bonificacao_regra_criterios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_regra_criterios" ADD CONSTRAINT "bonificacao_regra_criterios_regra_id_bonificacao_regras_id_fk" FOREIGN KEY ("regra_id") REFERENCES "erp"."bonificacao_regras"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."bonificacao_regras" ADD CONSTRAINT "bonificacao_regras_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."codigos_ocorrencia" ADD CONSTRAINT "codigos_ocorrencia_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."codigos_ocorrencia" ADD CONSTRAINT "codigos_ocorrencia_atualizado_por_usuarios_id_fk" FOREIGN KEY ("atualizado_por") REFERENCES "erp"."usuarios"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."coletas" ADD CONSTRAINT "coletas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."cte_prazo_historico" ADD CONSTRAINT "cte_prazo_historico_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."cte_prazo_historico" ADD CONSTRAINT "cte_prazo_historico_cte_id_ctes_id_fk" FOREIGN KEY ("cte_id") REFERENCES "erp"."ctes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."ctes" ADD CONSTRAINT "ctes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ctes" ADD CONSTRAINT "ctes_duplicado_de_ctes_id_fk" FOREIGN KEY ("duplicado_de") REFERENCES "erp"."ctes"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."ctes" ADD CONSTRAINT "ctes_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "erp"."unidades"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ctes" ADD CONSTRAINT "ctes_parceiro_id_parceiros_id_fk" FOREIGN KEY ("parceiro_id") REFERENCES "erp"."parceiros"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."ctes" ADD CONSTRAINT "ctes_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "erp"."equipes"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."equipe_membros" ADD CONSTRAINT "equipe_membros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."equipe_membros" ADD CONSTRAINT "equipe_membros_equipe_id_equipes_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "erp"."equipes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."equipe_membros" ADD CONSTRAINT "equipe_membros_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "erp"."usuarios"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."equipes" ADD CONSTRAINT "equipes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."equipes" ADD CONSTRAINT "equipes_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "erp"."unidades"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."feriados" ADD CONSTRAINT "feriados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."filiais" ADD CONSTRAINT "filiais_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."filiais_apelidos" ADD CONSTRAINT "filiais_apelidos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."unidades" ADD CONSTRAINT "unidades_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ingestao_aplicacoes" ADD CONSTRAINT "ingestao_aplicacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ingestao_aplicacoes" ADD CONSTRAINT "ingestao_aplicacoes_aplicado_por_usuarios_id_fk" FOREIGN KEY ("aplicado_por") REFERENCES "erp"."usuarios"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."ingestao_arquivos" ADD CONSTRAINT "ingestao_arquivos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ingestao_ciclos" ADD CONSTRAINT "ingestao_ciclos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ingestao_erros" ADD CONSTRAINT "ingestao_erros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ingestao_linhas" ADD CONSTRAINT "ingestao_linhas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ingestao_linhas" ADD CONSTRAINT "ingestao_linhas_arquivo_id_ingestao_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "erp"."ingestao_arquivos"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."ingestao_relatorios_esperados" ADD CONSTRAINT "ingestao_relatorios_esperados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."metas" ADD CONSTRAINT "metas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."metas" ADD CONSTRAINT "metas_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "erp"."unidades"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."ocorrencias" ADD CONSTRAINT "ocorrencias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ocorrencias" ADD CONSTRAINT "ocorrencias_cte_id_ctes_id_fk" FOREIGN KEY ("cte_id") REFERENCES "erp"."ctes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."ocorrencias" ADD CONSTRAINT "ocorrencias_codigo_fk" FOREIGN KEY ("empresa_id","codigo") REFERENCES "erp"."codigos_ocorrencia"("empresa_id","codigo") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."parceiros" ADD CONSTRAINT "parceiros_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."prazos_configurados" ADD CONSTRAINT "prazos_configurados_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."cte_dados_relatorios" ADD CONSTRAINT "cte_dados_relatorios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."romaneio_cte_atual" ADD CONSTRAINT "romaneio_cte_atual_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."romaneio_saidas_cte" ADD CONSTRAINT "romaneio_saidas_cte_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."romaneio_viagens_cte" ADD CONSTRAINT "romaneio_viagens_cte_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ssw_sincronizacoes" ADD CONSTRAINT "ssw_sincronizacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ssw_webhook_eventos" ADD CONSTRAINT "ssw_webhook_eventos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."ssw_webhook_eventos" ADD CONSTRAINT "ssw_webhook_eventos_cte_id_ctes_id_fk" FOREIGN KEY ("cte_id") REFERENCES "erp"."ctes"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."ssw_webhook_eventos" ADD CONSTRAINT "ssw_webhook_eventos_ocorrencia_id_ocorrencias_id_fk" FOREIGN KEY ("ocorrencia_id") REFERENCES "erp"."ocorrencias"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "erp"."xml_cte_arquivos" ADD CONSTRAINT "xml_cte_arquivos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."xml_cte_itens" ADD CONSTRAINT "xml_cte_itens_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."xml_cte_itens" ADD CONSTRAINT "xml_cte_itens_arquivo_id_xml_cte_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "erp"."xml_cte_arquivos"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "erp"."xml_cte_orfaos" ADD CONSTRAINT "xml_cte_orfaos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "erp"."xml_ftp_sincronizacoes" ADD CONSTRAINT "xml_ftp_sincronizacoes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "erp"."empresas"("id") ON DELETE restrict ON UPDATE no action;
CREATE INDEX "anotacoes_empresa_data_idx" ON "erp"."anotacoes" USING btree ("empresa_id","data");
CREATE INDEX "bi2_bruto_relatorio_data_idx" ON "erp"."bi2_bruto" USING btree ("empresa_id","codigo_relatorio","data_alvo");
CREATE INDEX "bi2_sincronizacoes_relatorio_iniciado_idx" ON "erp"."bi2_sincronizacoes" USING btree ("empresa_id","codigo_relatorio","iniciado_em" DESC NULLS LAST);
CREATE INDEX "bi2_sincronizacoes_relatorio_data_idx" ON "erp"."bi2_sincronizacoes" USING btree ("empresa_id","codigo_relatorio","data_alvo");
CREATE INDEX "bonificacao_parametros_vigencia_idx" ON "erp"."bonificacao_parametros" USING btree ("empresa_id","vigencia_inicio");
CREATE INDEX "bonificacao_regra_criterios_regra_idx" ON "erp"."bonificacao_regra_criterios" USING btree ("regra_id","ordem");
CREATE INDEX "bonificacao_regras_empresa_idx" ON "erp"."bonificacao_regras" USING btree ("empresa_id","vigencia_inicio");
CREATE INDEX "coletas_dia_cadastro_idx" ON "erp"."coletas" USING btree ("empresa_id","dia_cadastro","unidade");
CREATE INDEX "coletas_abertas_limite_idx" ON "erp"."coletas" USING btree ("empresa_id","limite_em") WHERE "erp"."coletas"."etapa" in ('cadastrada', 'comandada');
CREATE INDEX "coletas_cte_idx" ON "erp"."coletas" USING btree ("empresa_id","cte_sigla","cte_numero") WHERE "erp"."coletas"."cte_numero" is not null;
CREATE INDEX "cte_prazo_historico_cte_idx" ON "erp"."cte_prazo_historico" USING btree ("cte_id","criado_em" DESC NULLS LAST);
CREATE UNIQUE INDEX "ctes_empresa_sigla_numero_uq" ON "erp"."ctes" USING btree ("empresa_id","sigla","numero");
CREATE UNIQUE INDEX "ctes_empresa_chave_uq" ON "erp"."ctes" USING btree ("empresa_id","chave") WHERE "erp"."ctes"."chave" is not null;
CREATE INDEX "ctes_universo_filial_emissao_idx" ON "erp"."ctes" USING btree ("empresa_id","filial_efetiva","data_emissao") WHERE not "erp"."ctes"."fora_universo";
CREATE INDEX "ctes_universo_entrega_idx" ON "erp"."ctes" USING btree ("empresa_id","data_entrega_realizada") WHERE not "erp"."ctes"."fora_universo" and "erp"."ctes"."data_entrega_realizada" is not null;
CREATE INDEX "ctes_universo_previsao_idx" ON "erp"."ctes" USING btree ("empresa_id","data_prevista_entrega") WHERE not "erp"."ctes"."fora_universo" and "erp"."ctes"."data_prevista_entrega" is not null;
CREATE INDEX "ctes_universo_conclusao_idx" ON "erp"."ctes" USING btree ("empresa_id","data_conclusao_efetiva") WHERE not "erp"."ctes"."fora_universo" and "erp"."ctes"."data_conclusao_efetiva" is not null;
CREATE INDEX "ctes_universo_embarque_idx" ON "erp"."ctes" USING btree ("empresa_id","data_embarque") WHERE not "erp"."ctes"."fora_universo" and "erp"."ctes"."data_embarque" is not null;
CREATE INDEX "ctes_universo_abertos_idx" ON "erp"."ctes" USING btree ("empresa_id","data_emissao") WHERE not "erp"."ctes"."fora_universo" and "erp"."ctes"."data_entrega_realizada" is null;
CREATE INDEX "ctes_universo_pagador_idx" ON "erp"."ctes" USING btree ("empresa_id","pagador_cnpj_digitos","data_emissao") WHERE not "erp"."ctes"."fora_universo";
CREATE INDEX "ctes_universo_codigo_idx" ON "erp"."ctes" USING btree ("empresa_id","ocorr_efetiva_codigo_num","data_emissao") WHERE not "erp"."ctes"."fora_universo";
CREATE INDEX "ctes_unidade_emissao_idx" ON "erp"."ctes" USING btree ("empresa_id","unidade_id","data_emissao");
CREATE INDEX "ctes_parceiro_emissao_idx" ON "erp"."ctes" USING btree ("empresa_id","parceiro_id","data_emissao") WHERE "erp"."ctes"."parceiro_id" is not null;
CREATE INDEX "ctes_equipe_idx" ON "erp"."ctes" USING btree ("empresa_id","equipe_id") WHERE "erp"."ctes"."equipe_id" is not null;
CREATE INDEX "ctes_universo_atraso_idx" ON "erp"."ctes" USING btree ("empresa_id","atraso_dias" DESC NULLS LAST,"data_emissao" DESC NULLS LAST) WHERE not "erp"."ctes"."fora_universo" and "erp"."ctes"."atraso_dias" is not null;
CREATE INDEX "ctes_numero_idx" ON "erp"."ctes" USING btree ("empresa_id","numero");
CREATE INDEX "ctes_numero_nf_idx" ON "erp"."ctes" USING btree ("empresa_id","numero_nf") WHERE "erp"."ctes"."numero_nf" is not null;
CREATE INDEX "ctes_duplicado_de_idx" ON "erp"."ctes" USING btree ("duplicado_de") WHERE "erp"."ctes"."duplicado_de" is not null;
CREATE UNIQUE INDEX "equipe_membros_posicao_ativa_uq" ON "erp"."equipe_membros" USING btree ("equipe_id","posicao") WHERE "erp"."equipe_membros"."data_saida" is null and "erp"."equipe_membros"."posicao" > 0;
CREATE INDEX "equipe_membros_equipe_idx" ON "erp"."equipe_membros" USING btree ("equipe_id");
CREATE INDEX "equipe_membros_usuario_ativo_idx" ON "erp"."equipe_membros" USING btree ("empresa_id","usuario_id") WHERE "erp"."equipe_membros"."data_saida" is null;
CREATE UNIQUE INDEX "equipes_token_publico_uq" ON "erp"."equipes" USING btree ("token_publico_hash");
CREATE INDEX "equipes_empresa_unidade_idx" ON "erp"."equipes" USING btree ("empresa_id","unidade_id");
CREATE INDEX "feriados_empresa_data_idx" ON "erp"."feriados" USING btree ("empresa_id","data");
CREATE INDEX "filiais_propria_idx" ON "erp"."filiais" USING btree ("empresa_id") WHERE "erp"."filiais"."propria";
CREATE INDEX "unidades_empresa_idx" ON "erp"."unidades" USING btree ("empresa_id");
CREATE INDEX "ingestao_aplicacoes_iniciado_idx" ON "erp"."ingestao_aplicacoes" USING btree ("empresa_id","iniciado_em" DESC NULLS LAST);
CREATE UNIQUE INDEX "ingestao_arquivos_nome_uq" ON "erp"."ingestao_arquivos" USING btree ("empresa_id","nome_arquivo");
CREATE INDEX "ingestao_arquivos_ciclo_idx" ON "erp"."ingestao_arquivos" USING btree ("empresa_id","ciclo_chave","status");
CREATE INDEX "ingestao_arquivos_sha_idx" ON "erp"."ingestao_arquivos" USING btree ("empresa_id","sha256");
CREATE UNIQUE INDEX "ingestao_ciclos_chave_uq" ON "erp"."ingestao_ciclos" USING btree ("empresa_id","ciclo_chave");
CREATE INDEX "ingestao_ciclos_status_idx" ON "erp"."ingestao_ciclos" USING btree ("empresa_id","status","ciclo_chave");
CREATE INDEX "ingestao_ciclos_aplicado_idx" ON "erp"."ingestao_ciclos" USING btree ("empresa_id","aplicado_em" DESC NULLS LAST) WHERE "erp"."ingestao_ciclos"."aplicado_em" is not null;
CREATE INDEX "ingestao_erros_lote_idx" ON "erp"."ingestao_erros" USING btree ("empresa_id","lote_id");
CREATE INDEX "ingestao_erros_criado_idx" ON "erp"."ingestao_erros" USING btree ("empresa_id","criado_em" DESC NULLS LAST);
CREATE UNIQUE INDEX "ingestao_linhas_hash_uq" ON "erp"."ingestao_linhas" USING btree ("empresa_id","relatorio","hash");
CREATE INDEX "ingestao_linhas_cte_idx" ON "erp"."ingestao_linhas" USING btree ("empresa_id","numero","sigla","relatorio","importado_em" DESC NULLS LAST);
CREATE INDEX "ingestao_linhas_lote_idx" ON "erp"."ingestao_linhas" USING btree ("empresa_id","lote_id");
CREATE INDEX "ingestao_linhas_pendentes_idx" ON "erp"."ingestao_linhas" USING btree ("empresa_id","relatorio","id") WHERE "erp"."ingestao_linhas"."aplicado_em" is null;
CREATE INDEX "ingestao_linhas_aplicado_idx" ON "erp"."ingestao_linhas" USING btree ("aplicado_em") WHERE "erp"."ingestao_linhas"."aplicado_em" is not null;
CREATE INDEX "metas_empresa_unidade_idx" ON "erp"."metas" USING btree ("empresa_id","unidade_id");
CREATE UNIQUE INDEX "ocorrencias_protocolo_ssw_uq" ON "erp"."ocorrencias" USING btree ("empresa_id","protocolo_ssw") WHERE "erp"."ocorrencias"."protocolo_ssw" is not null;
CREATE INDEX "ocorrencias_codigo_data_idx" ON "erp"."ocorrencias" USING btree ("empresa_id","codigo","data_hora");
CREATE INDEX "ocorrencias_penaliza_cte_idx" ON "erp"."ocorrencias" USING btree ("cte_id") WHERE "erp"."ocorrencias"."penaliza";
CREATE INDEX "ocorrencias_quarentena_cte_idx" ON "erp"."ocorrencias" USING btree ("cte_id") WHERE "erp"."ocorrencias"."quarentena";
CREATE INDEX "ocorrencias_84_filial_idx" ON "erp"."ocorrencias" USING btree ("empresa_id","filial","data_hora") WHERE "erp"."ocorrencias"."codigo" = 84;
CREATE UNIQUE INDEX "parceiros_empresa_cnpj_uq" ON "erp"."parceiros" USING btree ("empresa_id","cnpj");
CREATE UNIQUE INDEX "prazos_configurados_unidade_uq" ON "erp"."prazos_configurados" USING btree ("empresa_id","unidade_codigo") WHERE "erp"."prazos_configurados"."tipo" = 'unidade';
CREATE UNIQUE INDEX "prazos_configurados_parceiro_uq" ON "erp"."prazos_configurados" USING btree ("empresa_id","parceiro_cnpj") WHERE "erp"."prazos_configurados"."tipo" = 'parceiro';
CREATE UNIQUE INDEX "prazos_configurados_transbordo_uq" ON "erp"."prazos_configurados" USING btree ("empresa_id","unidade_codigo","unidade_destino_codigo") WHERE "erp"."prazos_configurados"."tipo" = 'transbordo';
CREATE INDEX "romaneio_cte_atual_romaneio_idx" ON "erp"."romaneio_cte_atual" USING btree ("empresa_id","romaneio") WHERE "erp"."romaneio_cte_atual"."romaneio" is not null;
CREATE INDEX "romaneio_cte_atual_data_idx" ON "erp"."romaneio_cte_atual" USING btree ("empresa_id","data");
CREATE INDEX "romaneio_saidas_cte_data_idx" ON "erp"."romaneio_saidas_cte" USING btree ("empresa_id","data_saida");
CREATE INDEX "romaneio_viagens_cte_saida_idx" ON "erp"."romaneio_viagens_cte" USING btree ("empresa_id","data_saida");
CREATE INDEX "romaneio_viagens_cte_placa_idx" ON "erp"."romaneio_viagens_cte" USING btree ("empresa_id","placa","data_saida");
CREATE INDEX "romaneio_viagens_cte_motorista_idx" ON "erp"."romaneio_viagens_cte" USING btree ("empresa_id","motorista_normalizado","data_saida");
CREATE INDEX "romaneio_viagens_cte_ultima_idx" ON "erp"."romaneio_viagens_cte" USING btree ("empresa_id","data_saida") WHERE "erp"."romaneio_viagens_cte"."ultima";
CREATE INDEX "romaneio_viagens_cte_romaneio_idx" ON "erp"."romaneio_viagens_cte" USING btree ("empresa_id","romaneio");
CREATE INDEX "ssw_sincronizacoes_executado_idx" ON "erp"."ssw_sincronizacoes" USING btree ("empresa_id","executado_em" DESC NULLS LAST);
CREATE INDEX "ssw_webhook_eventos_recebido_idx" ON "erp"."ssw_webhook_eventos" USING btree ("empresa_id","recebido_em" DESC NULLS LAST);
CREATE INDEX "ssw_webhook_eventos_status_idx" ON "erp"."ssw_webhook_eventos" USING btree ("empresa_id","status_http","recebido_em" DESC NULLS LAST);
CREATE UNIQUE INDEX "xml_cte_arquivos_sha256_uq" ON "erp"."xml_cte_arquivos" USING btree ("empresa_id","sha256");
CREATE INDEX "xml_cte_arquivos_criado_idx" ON "erp"."xml_cte_arquivos" USING btree ("empresa_id","criado_em" DESC NULLS LAST);
CREATE UNIQUE INDEX "xml_cte_itens_sha_sucesso_uq" ON "erp"."xml_cte_itens" USING btree ("empresa_id","sha256_xml") WHERE "erp"."xml_cte_itens"."status" = 'sucesso';
CREATE INDEX "xml_cte_itens_arquivo_idx" ON "erp"."xml_cte_itens" USING btree ("arquivo_id","criado_em" DESC NULLS LAST);
CREATE UNIQUE INDEX "xml_cte_orfaos_sha256_uq" ON "erp"."xml_cte_orfaos" USING btree ("empresa_id","sha256_xml");
CREATE INDEX "xml_cte_orfaos_chave_idx" ON "erp"."xml_cte_orfaos" USING btree ("empresa_id","chave_cte");
CREATE INDEX "xml_cte_orfaos_pendentes_idx" ON "erp"."xml_cte_orfaos" USING btree ("empresa_id","criado_em") WHERE "erp"."xml_cte_orfaos"."status" = 'pendente';
CREATE INDEX "xml_ftp_sincronizacoes_executado_idx" ON "erp"."xml_ftp_sincronizacoes" USING btree ("empresa_id","executado_em" DESC NULLS LAST);
CREATE POLICY "anotacoes_empresa_select" ON "erp"."anotacoes" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "anotacoes_empresa_insert" ON "erp"."anotacoes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "anotacoes_empresa_update" ON "erp"."anotacoes" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "anotacoes_empresa_delete" ON "erp"."anotacoes" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_bruto_empresa_select" ON "erp"."bi2_bruto" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_bruto_empresa_insert" ON "erp"."bi2_bruto" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_bruto_empresa_update" ON "erp"."bi2_bruto" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_bruto_empresa_delete" ON "erp"."bi2_bruto" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_sincronizacoes_empresa_select" ON "erp"."bi2_sincronizacoes" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_sincronizacoes_empresa_insert" ON "erp"."bi2_sincronizacoes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_sincronizacoes_empresa_update" ON "erp"."bi2_sincronizacoes" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bi2_sincronizacoes_empresa_delete" ON "erp"."bi2_sincronizacoes" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_codigos_empresa_select" ON "erp"."bonificacao_codigos" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_codigos_empresa_insert" ON "erp"."bonificacao_codigos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_codigos_empresa_update" ON "erp"."bonificacao_codigos" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_codigos_empresa_delete" ON "erp"."bonificacao_codigos" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_faltas_empresa_select" ON "erp"."bonificacao_faltas" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_faltas_empresa_insert" ON "erp"."bonificacao_faltas" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_faltas_empresa_update" ON "erp"."bonificacao_faltas" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_faltas_empresa_delete" ON "erp"."bonificacao_faltas" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_parametros_empresa_select" ON "erp"."bonificacao_parametros" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_parametros_empresa_insert" ON "erp"."bonificacao_parametros" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_parametros_empresa_update" ON "erp"."bonificacao_parametros" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_parametros_empresa_delete" ON "erp"."bonificacao_parametros" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regra_criterios_empresa_select" ON "erp"."bonificacao_regra_criterios" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regra_criterios_empresa_insert" ON "erp"."bonificacao_regra_criterios" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regra_criterios_empresa_update" ON "erp"."bonificacao_regra_criterios" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regra_criterios_empresa_delete" ON "erp"."bonificacao_regra_criterios" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regras_empresa_select" ON "erp"."bonificacao_regras" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regras_empresa_insert" ON "erp"."bonificacao_regras" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regras_empresa_update" ON "erp"."bonificacao_regras" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "bonificacao_regras_empresa_delete" ON "erp"."bonificacao_regras" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "codigos_ocorrencia_empresa_select" ON "erp"."codigos_ocorrencia" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "codigos_ocorrencia_empresa_insert" ON "erp"."codigos_ocorrencia" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "codigos_ocorrencia_empresa_update" ON "erp"."codigos_ocorrencia" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "codigos_ocorrencia_empresa_delete" ON "erp"."codigos_ocorrencia" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "coletas_empresa_select" ON "erp"."coletas" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "coletas_empresa_insert" ON "erp"."coletas" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "coletas_empresa_update" ON "erp"."coletas" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "coletas_empresa_delete" ON "erp"."coletas" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_prazo_historico_empresa_select" ON "erp"."cte_prazo_historico" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_prazo_historico_empresa_insert" ON "erp"."cte_prazo_historico" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_prazo_historico_empresa_update" ON "erp"."cte_prazo_historico" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_prazo_historico_empresa_delete" ON "erp"."cte_prazo_historico" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ctes_empresa_select" ON "erp"."ctes" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ctes_empresa_insert" ON "erp"."ctes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ctes_empresa_update" ON "erp"."ctes" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ctes_empresa_delete" ON "erp"."ctes" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipe_membros_empresa_select" ON "erp"."equipe_membros" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipe_membros_empresa_insert" ON "erp"."equipe_membros" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipe_membros_empresa_update" ON "erp"."equipe_membros" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipe_membros_empresa_delete" ON "erp"."equipe_membros" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipes_empresa_select" ON "erp"."equipes" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipes_empresa_insert" ON "erp"."equipes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipes_empresa_update" ON "erp"."equipes" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipes_empresa_delete" ON "erp"."equipes" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "equipes_token_publico_select" ON "erp"."equipes" AS PERMISSIVE FOR SELECT TO public USING (not "erp"."equipes"."token_publico_revogado"
        and "erp"."equipes"."token_publico_hash" = nullif(current_setting('app.token_publico_hash', true), ''));
CREATE POLICY "feriados_select" ON "erp"."feriados" AS PERMISSIVE FOR SELECT TO public USING ("erp"."feriados"."empresa_id" is null or "erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "feriados_insert" ON "erp"."feriados" AS PERMISSIVE FOR INSERT TO public WITH CHECK ("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid
        or ("erp"."feriados"."empresa_id" is null and coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "feriados_update" ON "erp"."feriados" AS PERMISSIVE FOR UPDATE TO public USING ("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid
        or ("erp"."feriados"."empresa_id" is null and coalesce(current_setting('app.plataforma', true), 'off') = 'on')) WITH CHECK ("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid
        or ("erp"."feriados"."empresa_id" is null and coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "feriados_delete" ON "erp"."feriados" AS PERMISSIVE FOR DELETE TO public USING ("erp"."feriados"."empresa_id" = nullif(current_setting('app.empresa_id', true), '')::uuid
        or ("erp"."feriados"."empresa_id" is null and coalesce(current_setting('app.plataforma', true), 'off') = 'on'));
CREATE POLICY "filiais_empresa_select" ON "erp"."filiais" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "filiais_empresa_insert" ON "erp"."filiais" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "filiais_empresa_update" ON "erp"."filiais" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "filiais_empresa_delete" ON "erp"."filiais" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "filiais_apelidos_empresa_select" ON "erp"."filiais_apelidos" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "filiais_apelidos_empresa_insert" ON "erp"."filiais_apelidos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "filiais_apelidos_empresa_update" ON "erp"."filiais_apelidos" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "filiais_apelidos_empresa_delete" ON "erp"."filiais_apelidos" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "unidades_empresa_select" ON "erp"."unidades" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "unidades_empresa_insert" ON "erp"."unidades" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "unidades_empresa_update" ON "erp"."unidades" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "unidades_empresa_delete" ON "erp"."unidades" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_aplicacoes_empresa_select" ON "erp"."ingestao_aplicacoes" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_aplicacoes_empresa_insert" ON "erp"."ingestao_aplicacoes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_aplicacoes_empresa_update" ON "erp"."ingestao_aplicacoes" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_aplicacoes_empresa_delete" ON "erp"."ingestao_aplicacoes" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_arquivos_empresa_select" ON "erp"."ingestao_arquivos" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_arquivos_empresa_insert" ON "erp"."ingestao_arquivos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_arquivos_empresa_update" ON "erp"."ingestao_arquivos" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_arquivos_empresa_delete" ON "erp"."ingestao_arquivos" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_ciclos_empresa_select" ON "erp"."ingestao_ciclos" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_ciclos_empresa_insert" ON "erp"."ingestao_ciclos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_ciclos_empresa_update" ON "erp"."ingestao_ciclos" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_ciclos_empresa_delete" ON "erp"."ingestao_ciclos" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_erros_empresa_select" ON "erp"."ingestao_erros" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_erros_empresa_insert" ON "erp"."ingestao_erros" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_erros_empresa_update" ON "erp"."ingestao_erros" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_erros_empresa_delete" ON "erp"."ingestao_erros" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_linhas_empresa_select" ON "erp"."ingestao_linhas" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_linhas_empresa_insert" ON "erp"."ingestao_linhas" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_linhas_empresa_update" ON "erp"."ingestao_linhas" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_linhas_empresa_delete" ON "erp"."ingestao_linhas" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_relatorios_esperados_empresa_select" ON "erp"."ingestao_relatorios_esperados" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_relatorios_esperados_empresa_insert" ON "erp"."ingestao_relatorios_esperados" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_relatorios_esperados_empresa_update" ON "erp"."ingestao_relatorios_esperados" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ingestao_relatorios_esperados_empresa_delete" ON "erp"."ingestao_relatorios_esperados" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "metas_empresa_select" ON "erp"."metas" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "metas_empresa_insert" ON "erp"."metas" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "metas_empresa_update" ON "erp"."metas" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "metas_empresa_delete" ON "erp"."metas" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ocorrencias_empresa_select" ON "erp"."ocorrencias" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ocorrencias_empresa_insert" ON "erp"."ocorrencias" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ocorrencias_empresa_update" ON "erp"."ocorrencias" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ocorrencias_empresa_delete" ON "erp"."ocorrencias" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "parceiros_empresa_select" ON "erp"."parceiros" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "parceiros_empresa_insert" ON "erp"."parceiros" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "parceiros_empresa_update" ON "erp"."parceiros" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "parceiros_empresa_delete" ON "erp"."parceiros" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "prazos_configurados_empresa_select" ON "erp"."prazos_configurados" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "prazos_configurados_empresa_insert" ON "erp"."prazos_configurados" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "prazos_configurados_empresa_update" ON "erp"."prazos_configurados" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "prazos_configurados_empresa_delete" ON "erp"."prazos_configurados" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_dados_relatorios_empresa_select" ON "erp"."cte_dados_relatorios" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_dados_relatorios_empresa_insert" ON "erp"."cte_dados_relatorios" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_dados_relatorios_empresa_update" ON "erp"."cte_dados_relatorios" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "cte_dados_relatorios_empresa_delete" ON "erp"."cte_dados_relatorios" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_cte_atual_empresa_select" ON "erp"."romaneio_cte_atual" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_cte_atual_empresa_insert" ON "erp"."romaneio_cte_atual" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_cte_atual_empresa_update" ON "erp"."romaneio_cte_atual" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_cte_atual_empresa_delete" ON "erp"."romaneio_cte_atual" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_saidas_cte_empresa_select" ON "erp"."romaneio_saidas_cte" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_saidas_cte_empresa_insert" ON "erp"."romaneio_saidas_cte" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_saidas_cte_empresa_update" ON "erp"."romaneio_saidas_cte" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_saidas_cte_empresa_delete" ON "erp"."romaneio_saidas_cte" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_viagens_cte_empresa_select" ON "erp"."romaneio_viagens_cte" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_viagens_cte_empresa_insert" ON "erp"."romaneio_viagens_cte" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_viagens_cte_empresa_update" ON "erp"."romaneio_viagens_cte" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "romaneio_viagens_cte_empresa_delete" ON "erp"."romaneio_viagens_cte" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_sincronizacoes_empresa_select" ON "erp"."ssw_sincronizacoes" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_sincronizacoes_empresa_insert" ON "erp"."ssw_sincronizacoes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_sincronizacoes_empresa_update" ON "erp"."ssw_sincronizacoes" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_sincronizacoes_empresa_delete" ON "erp"."ssw_sincronizacoes" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_webhook_eventos_empresa_select" ON "erp"."ssw_webhook_eventos" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_webhook_eventos_empresa_insert" ON "erp"."ssw_webhook_eventos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_webhook_eventos_empresa_update" ON "erp"."ssw_webhook_eventos" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "ssw_webhook_eventos_empresa_delete" ON "erp"."ssw_webhook_eventos" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_arquivos_empresa_select" ON "erp"."xml_cte_arquivos" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_arquivos_empresa_insert" ON "erp"."xml_cte_arquivos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_arquivos_empresa_update" ON "erp"."xml_cte_arquivos" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_arquivos_empresa_delete" ON "erp"."xml_cte_arquivos" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_itens_empresa_select" ON "erp"."xml_cte_itens" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_itens_empresa_insert" ON "erp"."xml_cte_itens" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_itens_empresa_update" ON "erp"."xml_cte_itens" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_itens_empresa_delete" ON "erp"."xml_cte_itens" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_orfaos_empresa_select" ON "erp"."xml_cte_orfaos" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_orfaos_empresa_insert" ON "erp"."xml_cte_orfaos" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_orfaos_empresa_update" ON "erp"."xml_cte_orfaos" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_cte_orfaos_empresa_delete" ON "erp"."xml_cte_orfaos" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_ftp_sincronizacoes_empresa_select" ON "erp"."xml_ftp_sincronizacoes" AS PERMISSIVE FOR SELECT TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_ftp_sincronizacoes_empresa_insert" ON "erp"."xml_ftp_sincronizacoes" AS PERMISSIVE FOR INSERT TO public WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_ftp_sincronizacoes_empresa_update" ON "erp"."xml_ftp_sincronizacoes" AS PERMISSIVE FOR UPDATE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid) WITH CHECK (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);
CREATE POLICY "xml_ftp_sincronizacoes_empresa_delete" ON "erp"."xml_ftp_sincronizacoes" AS PERMISSIVE FOR DELETE TO public USING (empresa_id = nullif(current_setting('app.empresa_id', true), '')::uuid);