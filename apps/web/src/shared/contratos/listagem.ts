import { dataIso, decimal, inteiro, lista, paginacao, simNao, textoDeFiltro } from "../consulta";
import { contrato } from "../contrato";
import { z } from "../zod";

/**
 * Recortes da Listagem detalhada, na ordem do seletor. O CT-e entra se cair em qualquer um dos
 * marcados; "emitidos" não tem condição.
 * origem: TIPOS_RECORTE (src/features/performance/lista.functions.ts, sistema atual)
 */
export const TIPOS_RECORTE = [
  "emitidos",
  "entregues",
  "no_prazo",
  "fora_prazo",
  "atrasados",
  "sem_movimento",
  "penalizados",
  "penalizados_abertos",
  "em_atraso",
  "em_atraso_fr",
  "em_atraso_cliente",
  "por_codigo",
  "por_faixa_atraso",
  "finalizado_sistema",
  "previstos_por_status",
  "previstos_por_faixa",
  "sla_fr",
  "sla_cliente",
  "vencimento_proximo",
  "nascido_atrasado",
  "nascido_em_atraso",
  "otif",
  "sem_atualizacao",
  "ocorrencia_13",
  "ocorrencia_13_multipla",
  "tde_aguardando",
  "ocorr_entregues",
  "ocorr_baixados",
  "ocorr_abertos",
  "ocorr_em_atraso",
] as const;

export type TipoRecorte = (typeof TIPOS_RECORTE)[number];

/** `tipo` mais os extras, sem repetir e na ordem do seletor. */
export function recortesSelecionados(
  tipo: TipoRecorte,
  extras?: readonly TipoRecorte[] | null,
): TipoRecorte[] {
  const marcados = new Set<TipoRecorte>([tipo, ...(extras ?? [])]);
  return TIPOS_RECORTE.filter((t) => marcados.has(t));
}

/** Data que o período recorta. */
export const BASES_DATA = ["emissao", "prevista", "concluido"] as const;
export type BaseData = (typeof BASES_DATA)[number];

export const ORDENS_LISTA = ["atraso", "emissao", "prev", "entrega"] as const;
export type OrdemLista = (typeof ORDENS_LISTA)[number];

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

/** Itens por página na tela (a exportação pede páginas maiores). */
export const ITENS_POR_PAGINA = 100;
export const ITENS_POR_PAGINA_EXPORTACAO = 5000;

const siglaOuId = z.string().trim().max(60);

/** Filtro único da Listagem: lista, agregados, códigos do recorte e exportação usam o mesmo. */
export const filtroLista = z.object({
  tipo: z.enum(TIPOS_RECORTE).default("emitidos"),
  recortes: lista(z.enum(TIPOS_RECORTE)).optional(),
  inicio: dataIso.optional(),
  fim: dataIso.optional(),
  base: z.enum(BASES_DATA).default("emissao"),
  ignorarPeriodo: simNao.optional(),
  /** Sigla (gráfico, links da Performance) ou id de `unidades` (seletor por cadastro). */
  unidades: lista(siglaOuId).optional(),
  filiais: lista(siglaOuId).optional(),
  /** CNPJ do pagador, só dígitos. */
  parceiros: lista(z.string().trim().max(20)).optional(),
  remetente: textoDeFiltro.optional(),
  destino: textoDeFiltro.optional(),
  cidade: textoDeFiltro.optional(),
  /** Código da ocorrência efetiva (o mesmo dos cards da Performance). */
  codigos: lista(inteiro).optional(),
  /** Tipo de documento; `__SEM_TIPO__` = sem tipo. */
  tipos: lista(z.string().trim().max(60)).optional(),
  codigoRecorte: inteiro.optional(),
  faixaMin: inteiro.optional(),
  faixaMax: inteiro.optional(),
  pesoMin: decimal.optional(),
  pesoMax: decimal.optional(),
  atrasoMin: inteiro.optional(),
  atrasoMax: inteiro.optional(),
  statusPrevisto: z.enum(STATUS_PREVISTO).optional(),
  faixaPrev: z.enum(FAIXAS_PREVISTO).optional(),
  busca: z.string().max(60).optional(),
  ctrc: z.string().max(60).optional(),
  nf: z.string().max(60).optional(),
});

export type FiltroListaEntrada = z.input<typeof filtroLista>;
export type FiltroListaValidado = z.output<typeof filtroLista>;

const ordemEPagina = (maximo: number) => ({
  ordem: z.enum(ORDENS_LISTA).default("emissao"),
  direcao: z.enum(["asc", "desc"]).default("desc"),
  ...paginacao({ maximo, padrao: ITENS_POR_PAGINA }),
});

export const linhaLista = z.object({
  id: z.uuid(),
  sigla: z.string(),
  numero: z.string(),
  numeroNf: z.number().nullable(),
  destinatario: z.string().nullable(),
  cidadeDestino: z.string().nullable(),
  bairroDestino: z.string().nullable(),
  setor: z.string().nullable(),
  setorDestino: z.string().nullable(),
  /** Filial efetiva (unidade destino resolvida). */
  unidadeDestino: z.string().nullable(),
  codigo: z.number().int().nullable(),
  descricao: z.string().nullable(),
  /** Instante da ocorrência efetiva (ISO). */
  dataOcorrencia: z.string().nullable(),
  /** Só quando a ocorrência efetiva é 85 (saiu para entrega). */
  placa: z.string().nullable(),
  dataEmissao: z.string(),
  dataPrevista: z.string().nullable(),
  /** Dia da entrega no fuso da empresa (AAAA-MM-DD). */
  dataEntrega: z.string().nullable(),
  dataEmbarque: z.string().nullable(),
  parceiroNome: z.string().nullable(),
  pagadorNome: z.string().nullable(),
  remetente: z.string().nullable(),
  tipoDocumento: z.string().nullable(),
  peso: z.number().nullable(),
  valorFrete: z.number().nullable(),
  volumes: z.number().int().nullable(),
  localizacao: z.string().nullable(),
  primeiroManifesto: z.string().nullable(),
  ultimoManifesto: z.string().nullable(),
  valorMercadoria: z.number().nullable(),
  atrasoDias: z.number().int().nullable(),
  performanceDias: z.number().int().nullable(),
  noPrazo: z.boolean().nullable(),
  responsabilidadeCliente: z.boolean().nullable(),
  tde: z.number().nullable(),
});

export type LinhaLista = z.infer<typeof linhaLista>;

export const agregadoPorCodigo = z.object({
  codigo: z.number().int(),
  descricao: z.string().nullable(),
  qtd: z.number().int(),
});

export const agregadoPorFaixa = z.object({
  faixa: z.string(),
  ordem: z.number().int(),
  min: z.number().int(),
  max: z.number().int().nullable(),
  qtd: z.number().int(),
});

export const codigoDoRecorte = agregadoPorCodigo.extend({
  /** `tipo_ssw` do catálogo (PENDENCIA_CLIENTE, BAIXA...). */
  tipo: z.string().nullable(),
  penaliza: z.boolean(),
});

export type CodigoDoRecorte = z.infer<typeof codigoDoRecorte>;

export const contratosListagem = {
  /** Página da lista + total + os quatro gráficos, todos com o mesmo filtro. */
  listar: contrato({
    metodo: "GET",
    caminho: "/api/v1/performance/lista",
    entrada: filtroLista.extend(ordemEPagina(500)),
    saida: z.object({
      linhas: z.array(linhaLista),
      total: z.number().int(),
      porCodigo: z.array(agregadoPorCodigo),
      porUnidade: z.array(z.object({ unidade: z.string(), qtd: z.number().int() })),
      porCidade: z.array(z.object({ cidade: z.string(), qtd: z.number().int() })),
      porFaixa: z.array(agregadoPorFaixa),
    }),
  }),
  /** Só as linhas, em páginas grandes: a tela pede página a página até acabar. */
  exportar: contrato({
    metodo: "GET",
    caminho: "/api/v1/performance/lista/exportacao",
    entrada: filtroLista.extend(ordemEPagina(ITENS_POR_PAGINA_EXPORTACAO)),
    saida: z.object({ linhas: z.array(linhaLista), temMais: z.boolean() }),
  }),
  /** Opções do seletor "Ocorrência": códigos do recorte, ignorando o próprio filtro de códigos. */
  codigos: contrato({
    metodo: "GET",
    caminho: "/api/v1/performance/lista/codigos",
    entrada: filtroLista,
    saida: z.array(codigoDoRecorte),
  }),
} as const;
