/**
 * Agregado CT-e.
 *
 * - `ctes`: um conhecimento de transporte (o `ctrcs` do sistema atual). Identidade natural =
 *   empresa + sigla + número: o número sozinho se repete entre séries (CAP033214 ≠ CAS033214),
 *   e casar só pelo número já misturou CT-e no sistema atual.
 * - `cte_prazo_historico`: cada troca de `data_prevista_entrega` (antes gatilho
 *   `_trg_ctrcs_log_prazo`; agora gravado pelo caso de uso que muda a previsão).
 *
 * Colunas marcadas "calculada pelo backend" eram gatilho no sistema atual: o caso de uso que grava
 * o CT-e (ou a ocorrência / o catálogo de que elas dependem) recalcula e grava na mesma transação.
 * Nunca são gravadas soltas por outro caminho.
 *
 * Datas de negócio (emissão, previsão, conclusão) são `date` (dia em America/Sao_Paulo);
 * instantes (entrega, ocorrências) são `timestamptz`.
 *
 * Origem: public.ctrcs, public.ctrc_prazo_historico.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { erp, politicasDeEmpresa } from "../base";
import { atualizadoEm, criadoEm, empresaId, instante } from "./_comum";
import { equipes } from "./equipes";
import { unidades } from "./filiais";
import { parceiros } from "./parceiros";

export const prazoOrigem = erp.enum("prazo_origem", ["proprio", "parceiro"]);

/** De onde veio a previsão de entrega gravada. */
export const fontesDePrazo = [
  "xml_dprog",
  "consulta_prazo_oc80",
  "consulta_prazo_emissao",
  "regra_parceiro",
  "regra_transbordo",
  "regra_unidade",
  "fora_malha",
  "bi2",
  "ssw_manual",
  "ssw_038",
] as const;

const dia = (nome: string) => date(nome, { mode: "string" });

export const ctes = erp.table(
  "ctes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),

    // Identidade
    /** Série/sigla do CT-e no SSW (ex.: CAP, CAS). Maiúscula. */
    sigla: text("sigla").notNull(),
    /** Número do CTRC só com dígitos e sem zero à esquerda (como `ssw_num_ctrc`). */
    numero: text("numero").notNull(),
    /** Chave de 44 dígitos do CT-e (XML). */
    chave: text("chave"),
    siglaCte: text("sigla_cte"),
    numeroCte: bigint("numero_cte", { mode: "number" }),
    tipoDocumento: text("tipo_documento"),
    /** Tipo segundo o 455 (classificação detalhada do SSW); vence o `tipo_documento` do BI2. */
    tipoDocumento455: text("tipo_documento_455"),
    /** CT-e certo do qual este é cópia (número inexistente no SSW). Preenchido = fora das telas. */
    duplicadoDe: uuid("duplicado_de").references((): AnyPgColumn => ctes.id, {
      onDelete: "set null",
    }),

    // Datas de negócio
    dataEmissao: dia("data_emissao").notNull(),
    // calculada pelo backend: menor dia (America/Sao_Paulo) das ocorrências 82/85 do CT-e. origem: sync_data_embarque_from_ocorrencia
    dataEmbarque: dia("data_embarque"),
    dataEntregaRealizada: instante("data_entrega_realizada"),
    // calculada pelo backend: dia (SP) de data_entrega_realizada; sem ela, dia (SP) de ocorr_efetiva_data quando a ocorrência efetiva é de entrega ou finalizadora sem entrega. origem: _calc_data_conclusao_efetiva
    dataConclusaoEfetiva: dia("data_conclusao_efetiva"),

    // Relacionamentos
    unidadeId: uuid("unidade_id").references(() => unidades.id, { onDelete: "restrict" }),
    parceiroId: uuid("parceiro_id").references(() => parceiros.id, { onDelete: "set null" }),
    equipeId: uuid("equipe_id").references(() => equipes.id, { onDelete: "set null" }),

    // Partes
    remetente: text("remetente"),
    cnpjRemetente: text("cnpj_remetente"),
    destinatario: text("destinatario"),
    cnpjDestinatario: text("cnpj_destinatario"),
    pagadorNome: text("pagador_nome"),
    pagadorCnpj: text("pagador_cnpj"),
    // calculada pelo backend: só os dígitos de pagador_cnpj (filtro de pagador da tela e índice). origem: regexp_replace(pagador_cnpj, '\D', '') das RPCs
    pagadorCnpjDigitos: text("pagador_cnpj_digitos"),
    /** Expedidor do CT-e pelo 455 (rótulo "parceiro" das telas). */
    parceiroCnpj: text("parceiro_cnpj"),
    parceiroNome: text("parceiro_nome"),

    // Destino
    cidadeDestino: text("cidade_destino"),
    ufDestino: text("uf_destino"),
    bairroDestino: text("bairro_destino"),
    logradouroDestino: text("logradouro_destino"),
    numeroEnderecoDestino: text("numero_endereco_destino"),
    complementoDestino: text("complemento_destino"),
    cepDestinatario: text("cep_destinatario"),
    setor: text("setor"),
    setorDestino: text("setor_destino"),

    // Unidades / filiais (siglas SSW)
    filial: text("filial"),
    unidadeOrigem: text("unidade_origem"),
    unidadeDestino: text("unidade_destino"),
    unidadeAtual: text("unidade_atual"),
    localizacaoAtual: text("localizacao_atual"),
    // calculada pelo backend: coalesce(unidade_destino, unidade_atual, filial) — a sigla que decide o universo (filial própria) e o filtro de filial das telas. origem: expressão repetida nas RPCs
    filialEfetiva: text("filial_efetiva"),
    // calculada pelo backend: cidade da filial (filiais.sigla = filial). origem: _trg_ctrcs_unidade_cidade_por_filial
    unidadeCidade: text("unidade_cidade"),
    // calculada pelo backend: UF da filial (filiais.sigla = filial). origem: _trg_ctrcs_unidade_cidade_por_filial
    unidadeUf: text("unidade_uf"),

    // Nota fiscal e carga
    chaveNfe: text("chave_nfe"),
    numeroNf: integer("numero_nf"),
    serieNf: text("serie_nf"),
    peso: numeric("peso", { precision: 12, scale: 3 }),
    volumes: integer("volumes"),
    valorFrete: numeric("valor_frete", { precision: 14, scale: 2 }),
    valorMercadoria: numeric("valor_mercadoria", { precision: 14, scale: 2 }),
    /** Taxa de dificuldade de entrega (455). */
    tde: numeric("tde", { precision: 14, scale: 2 }),
    nroManifesto: text("nro_manifesto"),
    primeiroManifesto: text("primeiro_manifesto"),
    ultimoManifesto: text("ultimo_manifesto"),

    // Prazo
    prazoEntrega: dia("prazo_entrega"),
    prazoOrigem: prazoOrigem("prazo_origem").notNull().default("proprio"),
    prazoContratadoDias: integer("prazo_contratado_dias"),
    prazoFonte: text("prazo_fonte", { enum: fontesDePrazo }),
    dataBasePrazo: instante("data_base_prazo"),
    dataPrevistaEntrega: dia("data_prevista_entrega"),
    /**
     * Previsão (e fonte) que veio do SSW, guardada à parte: a regra de prazo configurado
     * sobrescreve `data_prevista_entrega` e, quando deixa de valer, a previsão volta a esta
     * (decisão Q19 do dono).
     */
    previsaoSsw: dia("previsao_ssw"),
    previsaoSswFonte: text("previsao_ssw_fonte", { enum: fontesDePrazo }),
    // calculada pelo backend: 2 dias corridos (48 h); nulo para pagador/parceiro com raiz de CNPJ 00193687 (TROCA). origem: prazo_padrao_do_ctrc
    prazoPadraoDias: smallint("prazo_padrao_dias"),
    // calculada pelo backend: data_emissao + prazo_padrao_dias; nulo se a previsão é anterior à emissão. Nascido em atraso = previsão < esta data. origem: prazo_padrao_data_do_ctrc
    prazoPadraoData: dia("prazo_padrao_data"),

    // Performance (BI2 0017 / SLA pelos arquivos)
    performanceDias: integer("performance_dias"),
    noPrazo: boolean("no_prazo"),
    responsabilidadeCliente: boolean("responsabilidade_cliente"),
    fontePerformance: text("fonte_performance"),
    /** Foto do BI2 0013: não avança com os dias (aberto = hoje − previsão, calculado na consulta). */
    atrasoDias: integer("atraso_dias"),

    // Operação
    // calculada pelo backend: descrição (ou a do catálogo) da ocorrência mais recente por data_hora. origem: sync_status_atual_from_ocorrencia
    statusAtual: text("status_atual"),
    motoristaNome: text("motorista_nome"),
    ajudanteNome: text("ajudante_nome"),
    placaColeta: text("placa_coleta"),
    placaEntrega: text("placa_entrega"),
    comprovanteEscaneado: boolean("comprovante_escaneado"),
    comprovanteEscaneadoEm: instante("comprovante_escaneado_em"),

    // Fontes da ocorrência efetiva
    ultimaOcorrCodigo0013: text("ultima_ocorr_codigo_0013"),
    ultimaOcorrData0013: instante("ultima_ocorr_data_0013"),
    ultOcorrCodigo0174: text("ult_ocorr_codigo_0174"),
    ultOcorrDescricao0174: text("ult_ocorr_descricao_0174"),
    ultOcorrData0174: instante("ult_ocorr_data_0174"),
    ultOcorrLocal0174: text("ult_ocorr_local_0174"),
    ultOcorrInstrucao0174: text("ult_ocorr_instrucao_0174"),
    ocorr036Codigo: text("ocorr_036_codigo"),
    ocorr036Descricao: text("ocorr_036_descricao"),
    ocorr036Data: instante("ocorr_036_data"),

    // Ocorrência efetiva
    // calculada pelo backend: ocorrência que vale para o CT-e entre 0174, 0013, 036 e ocorrências (930/webhook), com a precedência e o estorno (86) da spec. origem: _calc_ocorr_efetiva / recompute_ocorr_efetiva
    ocorrEfetivaCodigo: text("ocorr_efetiva_codigo"),
    // calculada pelo backend: dígitos de ocorr_efetiva_codigo como número (filtro de códigos das telas). origem: norm_codigo_ocorr
    ocorrEfetivaCodigoNum: smallint("ocorr_efetiva_codigo_num"),
    // calculada pelo backend: junto com ocorr_efetiva_codigo. origem: _calc_ocorr_efetiva
    ocorrEfetivaDescricao: text("ocorr_efetiva_descricao"),
    // calculada pelo backend: junto com ocorr_efetiva_codigo. origem: _calc_ocorr_efetiva
    ocorrEfetivaData: instante("ocorr_efetiva_data"),
    // calculada pelo backend: junto com ocorr_efetiva_codigo (qual fonte venceu). origem: _calc_ocorr_efetiva
    ocorrEfetivaFonte: text("ocorr_efetiva_fonte"),
    // calculada pelo backend: junto com ocorr_efetiva_codigo. origem: _calc_ocorr_efetiva
    ocorrEfetivaLocal: text("ocorr_efetiva_local"),

    // Universo
    // calculada pelo backend: existe ocorrência 99 cujo dia (SP) = data_emissao. Recalcula quando muda a emissão ou entra/sai ocorrência 99. origem: _trg_ctrcs_calc_cancelado_mesmo_dia / _trg_ocorrencias_recompute_cancelado
    canceladoMesmoDia: boolean("cancelado_mesmo_dia").notNull().default(false),
    // calculada pelo backend: cancelado_mesmo_dia OU duplicado_de preenchido. true = fora de todas as telas. origem: _trg_ctrcs_fora_universo
    foraUniverso: boolean("fora_universo").notNull().default(false),
    // calculada pelo backend: colunas cujo valor veio dos relatórios SSW (038/455/930/036); o BI2 não sobrescreve essas colunas. origem: aplicar_staging_ssw / _trg_ctrcs_bi2_preserva_ssw
    camposSsw: text("campos_ssw")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),

    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    // Identidade natural: empresa + sigla + número.
    uniqueIndex("ctes_empresa_sigla_numero_uq").on(t.empresaId, t.sigla, t.numero),
    uniqueIndex("ctes_empresa_chave_uq")
      .on(t.empresaId, t.chave)
      .where(sql`${t.chave} is not null`),
    check("ctes_numero_digitos_ck", sql`${t.numero} ~ '^[1-9][0-9]*$'`),
    check("ctes_sigla_maiuscula_ck", sql`${t.sigla} ~ '^[A-Z]+$'`),
    check(
      "ctes_prazo_padrao_dias_ck",
      sql`${t.prazoPadraoDias} is null or ${t.prazoPadraoDias} >= 0`,
    ),
    check(
      "ctes_prazo_fonte_ck",
      sql`${t.prazoFonte} is null or ${t.prazoFonte} in (${sql.raw(
        fontesDePrazo.map((f) => `'${f}'`).join(", "),
      )})`,
    ),
    check(
      "ctes_previsao_ssw_fonte_ck",
      sql`${t.previsaoSswFonte} is null or ${t.previsaoSswFonte} in (${sql.raw(
        fontesDePrazo.map((f) => `'${f}'`).join(", "),
      )})`,
    ),

    // Período por emissão dentro do universo (a consulta-base de Performance, Listagem,
    // Ocorrências, Ranking e Romaneio) é o índice de cobertura `ctes_universo_emissao_cobre_idx`,
    // em docs/dados/ddl-complementar.sql: o Drizzle não expressa INCLUDE.
    // Telas por filial (romaneio, pendências por unidade, opções de filial).
    index("ctes_universo_filial_emissao_idx")
      .on(t.empresaId, t.filialEfetiva, t.dataEmissao)
      .where(sql`not ${t.foraUniverso}`),
    // Período por entrega / previsão / conclusão / embarque (seletor "base de data" das telas).
    index("ctes_universo_entrega_idx")
      .on(t.empresaId, t.dataEntregaRealizada)
      .where(sql`not ${t.foraUniverso} and ${t.dataEntregaRealizada} is not null`),
    index("ctes_universo_previsao_idx")
      .on(t.empresaId, t.dataPrevistaEntrega)
      .where(sql`not ${t.foraUniverso} and ${t.dataPrevistaEntrega} is not null`),
    index("ctes_universo_conclusao_idx")
      .on(t.empresaId, t.dataConclusaoEfetiva)
      .where(sql`not ${t.foraUniverso} and ${t.dataConclusaoEfetiva} is not null`),
    index("ctes_universo_embarque_idx")
      .on(t.empresaId, t.dataEmbarque)
      .where(sql`not ${t.foraUniverso} and ${t.dataEmbarque} is not null`),
    // CT-e em aberto (sem entrega): alertas, previstos, "sem movimento", travados.
    index("ctes_universo_abertos_idx")
      .on(t.empresaId, t.dataEmissao)
      .where(sql`not ${t.foraUniverso} and ${t.dataEntregaRealizada} is null`),
    // Filtros de tela mais seletivos que o período.
    index("ctes_universo_pagador_idx")
      .on(t.empresaId, t.pagadorCnpjDigitos, t.dataEmissao)
      .where(sql`not ${t.foraUniverso}`),
    index("ctes_universo_codigo_idx")
      .on(t.empresaId, t.ocorrEfetivaCodigoNum, t.dataEmissao)
      .where(sql`not ${t.foraUniverso}`),
    index("ctes_unidade_emissao_idx").on(t.empresaId, t.unidadeId, t.dataEmissao),
    index("ctes_parceiro_emissao_idx")
      .on(t.empresaId, t.parceiroId, t.dataEmissao)
      .where(sql`${t.parceiroId} is not null`),
    index("ctes_equipe_idx")
      .on(t.empresaId, t.equipeId)
      .where(sql`${t.equipeId} is not null`),
    // Lista ordenada por atraso (Listagem detalhada).
    index("ctes_universo_atraso_idx")
      .on(t.empresaId, t.atrasoDias.desc(), t.dataEmissao.desc())
      .where(sql`not ${t.foraUniverso} and ${t.atrasoDias} is not null`),
    // Busca por número (sem sigla) e por NF na caixa de busca.
    index("ctes_numero_idx").on(t.empresaId, t.numero),
    index("ctes_numero_nf_idx")
      .on(t.empresaId, t.numeroNf)
      .where(sql`${t.numeroNf} is not null`),
    index("ctes_duplicado_de_idx")
      .on(t.duplicadoDe)
      .where(sql`${t.duplicadoDe} is not null`),
    ...politicasDeEmpresa("ctes", t.empresaId),
  ],
);

export const ctePrazoHistorico = erp.table(
  "cte_prazo_historico",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    cteId: uuid("cte_id")
      .notNull()
      .references(() => ctes.id, { onDelete: "cascade" }),
    dataAnterior: dia("data_anterior"),
    dataNova: dia("data_nova"),
    /** `prazo_fonte` do CT-e no momento da troca. */
    fonte: text("fonte"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("cte_prazo_historico_cte_idx").on(t.cteId, t.criadoEm.desc()),
    ...politicasDeEmpresa("cte_prazo_historico", t.empresaId),
  ],
);
