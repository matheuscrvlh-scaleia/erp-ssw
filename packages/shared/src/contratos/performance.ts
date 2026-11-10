import { contrato } from "../contrato";
import { ehDataIso } from "../datas";
import { z } from "../zod";

/** Valor do filtro "Tipo documento" para CT-e sem tipo (nem 455 nem BI2). */
export const SEM_TIPO_DOCUMENTO = "__SEM_TIPO__";

/** Campo de data que o período recorta (alternador Emitidos / Data Prevista / Concluídos). */
export const BASES_DE_DATA = ["emissao", "prevista", "concluido"] as const;
export type BaseDeData = (typeof BASES_DE_DATA)[number];

const dataIso = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).");
const lista = z.array(z.string().max(200)).max(500);

/**
 * Filtros da tela Performance (iguais aos de hoje). `unidades` aceita uuid da unidade ou sigla
 * (links de outras telas); `parceiros` é o CNPJ do pagador; `codigos` são os códigos da
 * ocorrência efetiva; `tipos` usa `SEM_TIPO_DOCUMENTO` para "sem tipo".
 * origem: _perf_filtro_ctrcs (sistema atual)
 */
export const filtroPerformance = z.object({
  inicio: dataIso,
  fim: dataIso,
  unidades: lista.nullish(),
  parceiros: lista.nullish(),
  remetente: z.string().max(500).nullish(),
  destino: z.string().max(500).nullish(),
  filiais: lista.nullish(),
  tipos: lista.nullish(),
  codigos: lista.nullish(),
  baseData: z.enum(BASES_DE_DATA).default("emissao"),
});

export type FiltroPerformanceEntrada = z.input<typeof filtroPerformance>;
export type FiltroPerformanceValidado = z.output<typeof filtroPerformance>;

const inteiro = z.number().int();
const fracao = z.number().nullable();

// ---------------------------------------------------------------- resumo + produção

export const unidadeResumo = z.object({
  sigla: z.string(),
  total: inteiro,
  concluidos: inteiro,
  /** Concluídos com ocorrência penalizante. */
  penalizados: inteiro,
  penalizadosAbertos: inteiro,
  performance: z.number(),
});
export type UnidadeResumo = z.infer<typeof unidadeResumo>;

export const totaisResumo = z.object({
  totalCtrcs: inteiro,
  ctrcsPenalizados: inteiro,
  ctrcsConcluidos: inteiro,
  performance: z.number(),
  taxaRetorno: z.number(),
  ocorrenciasPenalizantes: inteiro,
  ocorrenciasPendentes: inteiro,
  ctrcsEmAberto: inteiro,
  ctrcsEmAtraso: inteiro,
  ctrcsEmAtrasoFr: inteiro,
  ctrcsEmAtrasoCliente: inteiro,
  ctrcsSemPrazo: inteiro,
});
export type TotaisResumo = z.infer<typeof totaisResumo>;

/** Agregados da linha de Produção (o bloco é montado com resumo + pontualidade). */
export const agregadosProducao = z.object({
  totalCtrcs: inteiro,
  entregues: inteiro,
  finalizadoSemEntrega: inteiro,
  previstos: inteiro,
  devolvidos: inteiro,
  valorFreteTotal: z.number(),
  valorFretePerdido: z.number(),
});
export type AgregadosProducao = z.infer<typeof agregadosProducao>;

export const resumoPerformance = z.object({
  periodo: z.object({ inicio: z.string(), fim: z.string(), dias: inteiro }),
  totais: totaisResumo,
  metaTaxaRetorno: fracao,
  porUnidade: z.array(unidadeResumo),
  producao: agregadosProducao,
  unidades: z.array(z.object({ id: z.string(), nome: z.string() })),
  cobertura: z.object({ min: z.string().nullable(), max: z.string().nullable() }),
});
export type ResumoPerformance = z.infer<typeof resumoPerformance>;

// ---------------------------------------------------------------- pontualidade

const contagensPontualidade = {
  total: inteiro,
  noPrazo: inteiro,
  foraPrazo: inteiro,
  semInfoBi2: inteiro,
  excluidoCliente: inteiro,
  noPrazoCliente: inteiro,
  foraPrazoCliente: inteiro,
  nascidosAvaliados: inteiro,
  nascidosAtraso: inteiro,
};

export const unidadePontualidade = z.object({
  sigla: z.string(),
  ...contagensPontualidade,
  performancePct: fracao,
  slaClientePct: fracao,
  nascidosPct: fracao,
});
export type UnidadePontualidade = z.infer<typeof unidadePontualidade>;

export const pontualidade = z.object({
  totais: z.object({
    ...contagensPontualidade,
    totalCliente: inteiro,
    performancePct: fracao,
    slaClientePct: fracao,
    nascidosPct: fracao,
    pendente: inteiro,
    semPrazo: inteiro,
  }),
  porUnidade: z.array(unidadePontualidade),
});
export type Pontualidade = z.infer<typeof pontualidade>;

// ---------------------------------------------------------------- TDE, OTIF, previstos

export const tdeAguardando = z.object({
  aguardando: inteiro,
  valor: z.number(),
  total: inteiro,
});
export type TdeAguardando = z.infer<typeof tdeAguardando>;

export const otif = z.object({ total: inteiro, problemas: inteiro, pct: fracao }).nullable();
export type Otif = z.infer<typeof otif>;

export const STATUS_PREVISTO = [
  "agendamento",
  "programacao",
  "rota",
  "pendencia",
  "outros",
] as const;
export type StatusPrevisto = (typeof STATUS_PREVISTO)[number];
export const FAIXAS_PREVISTO = ["vencido", "hoje", "d1", "d2", "d3_mais", "sem_prev"] as const;
export type FaixaPrevisto = (typeof FAIXAS_PREVISTO)[number];

const somasPrevisto = { qtd: inteiro, peso: z.number(), volumes: inteiro, frete: z.number() };
export const previstos = z.object({
  status: z.array(z.object({ key: z.enum(STATUS_PREVISTO), ...somasPrevisto })),
  faixa: z.array(z.object({ key: z.enum(FAIXAS_PREVISTO), ...somasPrevisto })),
  total: z.object(somasPrevisto),
});
export type Previstos = z.infer<typeof previstos>;
export type SomasPrevisto = z.infer<typeof previstos>["total"];

// ---------------------------------------------------------------- alertas

const topUnidade = z.object({ unidade: z.string(), qtd: inteiro });

export const alertas = z.object({
  semMovimento: z.object({ count: inteiro }),
  quedaSla: z.object({
    count: inteiro,
    items: z.array(
      z.object({
        unidade: z.string(),
        slaAtual: z.number(),
        slaAnterior: z.number(),
        quedaPp: z.number(),
        totalAtual: inteiro,
      }),
    ),
  }),
  vencendo: z.object({
    count: inteiro,
    topParceiros: z.array(
      z.object({ parceiroId: z.string(), parceiroNome: z.string().nullable(), qtd: inteiro }),
    ),
  }),
  nascidoAtrasado: z.object({ count: inteiro, topUnidades: z.array(topUnidade) }),
  finSistemaAnomalo: z.object({
    count: inteiro,
    items: z.array(
      z.object({
        unidade: z.string(),
        pctAtual: z.number(),
        pctBaseline: z.number(),
        desvioPp: z.number(),
        qtdAtual: inteiro,
      }),
    ),
  }),
  semAtualizacao: z.object({ count: inteiro, topUnidades: z.array(topUnidade) }),
  ocorrencia13: z.object({ count: inteiro, topUnidades: z.array(topUnidade) }),
  ocorrencia13Multipla: z.object({ count: inteiro, topUnidades: z.array(topUnidade) }),
  limites: z.object({
    vermelhoPct: z.number(),
    diasSemMovimento: inteiro,
    quedaSlaPp: z.number(),
    janelaTendenciaDias: inteiro,
    janelaVencimentoH: inteiro,
    minVencimento: inteiro,
    nascidoAtrasadoMin: inteiro,
    desvioFinsistemaPp: z.number(),
    diasSemAtualizacao: inteiro,
  }),
});
export type Alertas = z.infer<typeof alertas>;
export type LimitesDosAlertas = Alertas["limites"];

// ---------------------------------------------------------------- seletores

export const codigoDisponivel = z.object({
  codigo: z.string(),
  descricao: z.string().nullable(),
  qtd: inteiro,
});
export type CodigoDisponivel = z.infer<typeof codigoDisponivel>;

export const contagemTipo = z.object({ tipo: z.string(), qtd: inteiro });
export type ContagemTipo = z.infer<typeof contagemTipo>;

// ---------------------------------------------------------------- série

export const GRANULARIDADES = ["dia", "mes"] as const;
export type Granularidade = (typeof GRANULARIDADES)[number];

export const pontoSerie = z.object({
  periodo: z.string(),
  totalCtrcs: inteiro,
  entregue: inteiro,
  foraTransp: inteiro,
  noPrazoOp: inteiro,
  foraPrazoOp: inteiro,
  noPrazoCli: inteiro,
  foraPrazoCli: inteiro,
});
export type PontoSerie = z.infer<typeof pontoSerie>;

// ---------------------------------------------------------------- relatório de período

/** Bloco de Produção/Qualidade (tela e relatório). Percentuais de 0 a 100. */
export const blocoProducao = z.object({
  totalCtrcs: inteiro,
  entregues: inteiro,
  finalizadoSistema: inteiro,
  previstos: inteiro,
  devolvidos: inteiro,
  noPrazo: inteiro,
  foraPrazo: inteiro,
  pendentePrazo: inteiro,
  semPrazo: inteiro,
  valorFreteTotal: z.number(),
  valorFretePerdido: z.number(),
  pctFretePerdido: fracao,
  /** SLA por ocorrência penalizante (rótulo "SLA de Pontualidade" nas telas). */
  slaOperacionalPct: fracao,
  /** Pontualidade sobre emitidos (rótulo "SLA Operacional" nas telas). */
  slaPontualidadePct: fracao,
  taxaRetornoPct: z.number(),
  totalCliente: inteiro,
  noPrazoCliente: inteiro,
  foraPrazoCliente: inteiro,
  slaClientePct: fracao,
});
export type BlocoProducao = z.infer<typeof blocoProducao>;

export const unidadeRelatorio = z.object({
  sigla: z.string(),
  cidade: z.string().nullable(),
  uf: z.string().nullable(),
  total: inteiro,
  entregues: inteiro,
  producaoPct: fracao,
  slaOperacionalPct: fracao,
  slaPontualidadePct: fracao,
});
export type UnidadeRelatorio = z.infer<typeof unidadeRelatorio>;

export const impactoCodigo = z.object({
  codigo: z.string(),
  descricao: z.string().nullable(),
  penaliza: z.boolean(),
  totalCtrcs: inteiro,
  totalPenalizantes: inteiro,
  pctDoTotal: z.number(),
});
export type ImpactoCodigo = z.infer<typeof impactoCodigo>;

const fotoDoPeriodo = z.object({
  periodo: z.object({ inicio: z.string(), fim: z.string() }),
  atual: blocoProducao,
  porUnidade: z.array(unidadeRelatorio),
  impactoCodigos: z.array(impactoCodigo),
  impactoTotalPeriodo: inteiro,
  impactoBaseComOcorrencia: inteiro,
  penalizantes: z.object({ ocorrencias: inteiro, ctrcsAfetados: inteiro }),
  finalizadoPorCodigo: z.array(
    z.object({ codigo: inteiro, descricao: z.string().nullable(), qtd: inteiro }),
  ),
  previstosTodos: previstos,
  previstosPeriodo: previstos,
});
export type FotoDoPeriodo = z.infer<typeof fotoDoPeriodo>;

export const relatorioPeriodo = fotoDoPeriodo.extend({
  comparativo: fotoDoPeriodo.nullable(),
  filtrosAplicados: z.object({
    parceirosRotulos: z.array(z.string()),
    codigos: z.array(z.string()),
  }),
  limites: z.object({ slaMetaPct: z.number(), taxaRetornoMetaPct: z.number() }),
});
export type RelatorioPeriodo = z.infer<typeof relatorioPeriodo>;

// ---------------------------------------------------------------- exportação da tela

export const linhaExportacao = z.object({
  numeroNf: inteiro.nullable(),
  numero: z.string(),
  sigla: z.string(),
  dataEmissao: z.string(),
  unidade: z.string().nullable(),
  remetente: z.string().nullable(),
  destinatario: z.string().nullable(),
  cidadeDestino: z.string().nullable(),
  peso: z.number().nullable(),
  volumes: inteiro.nullable(),
  valorFrete: z.number().nullable(),
  placaRomaneio: z.string().nullable(),
  motorista: z.string().nullable(),
  placaColeta: z.string().nullable(),
  placaEntrega: z.string().nullable(),
  cteVinculo: z.string().nullable(),
  romaneio: z.string().nullable(),
  codigo: inteiro.nullable(),
  descricao: z.string().nullable(),
  dataHora: z.string().nullable(),
  status: z.string().nullable(),
});
export type LinhaExportacao = z.infer<typeof linhaExportacao>;

// ---------------------------------------------------------------- configuração da tela

export const configuracaoPerformance = z.object({
  slaMetaPct: z.number(),
  slaAlertaAmareloPct: z.number(),
  taxaRetornoMetaPct: z.number(),
  otifVisivel: z.boolean(),
});
export type ConfiguracaoPerformance = z.infer<typeof configuracaoPerformance>;

export const contratosPerformance = {
  configuracao: contrato({
    metodo: "GET",
    caminho: "/api/v1/performance/configuracao",
    saida: configuracaoPerformance,
  }),
  resumo: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/resumo",
    entrada: filtroPerformance,
    saida: resumoPerformance,
  }),
  pontualidade: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/pontualidade",
    entrada: filtroPerformance,
    saida: pontualidade,
  }),
  tdeAguardando: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/tde-aguardando",
    entrada: filtroPerformance,
    saida: tdeAguardando,
  }),
  otif: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/otif",
    entrada: filtroPerformance,
    saida: otif,
  }),
  previstos: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/previstos",
    entrada: filtroPerformance.extend({ ignorarPeriodo: z.boolean().default(false) }),
    saida: previstos,
  }),
  alertas: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/alertas",
    entrada: filtroPerformance,
    saida: alertas,
  }),
  codigosDisponiveis: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/codigos-disponiveis",
    entrada: filtroPerformance,
    saida: z.array(codigoDisponivel),
  }),
  tiposDocumento: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/tipos-documento",
    entrada: filtroPerformance,
    saida: z.array(contagemTipo),
  }),
  serie: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/serie",
    entrada: filtroPerformance.extend({ granularidade: z.enum(GRANULARIDADES) }),
    saida: z.array(pontoSerie),
  }),
  relatorio: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/relatorio",
    entrada: filtroPerformance.extend({
      comparativoInicio: dataIso.nullish(),
      comparativoFim: dataIso.nullish(),
    }),
    saida: relatorioPeriodo,
  }),
  exportacao: contrato({
    metodo: "POST",
    caminho: "/api/v1/performance/exportacao",
    entrada: filtroPerformance,
    saida: z.object({ linhas: z.array(linhaExportacao), truncado: z.boolean() }),
  }),
} as const;
