import { contrato } from "@erp/shared/contract";
import { dataIso, listaComTeto, paginacao } from "@erp/shared/query";
import { z } from "@erp/shared/zod";

/** Responsável gravado no catálogo de códigos. */
export const RESPONSAVEIS = [
  "FR",
  "transportador",
  "destinatario",
  "cliente",
  "sistema",
  "outro",
] as const;
export type Responsavel = (typeof RESPONSAVEIS)[number];

/** Responsável de um evento na tela: o do catálogo, ou "pendente" se o código não foi classificado. */
export const RESPONSAVEIS_DO_EVENTO = [...RESPONSAVEIS, "pendente"] as const;
export type ResponsavelDoEvento = (typeof RESPONSAVEIS_DO_EVENTO)[number];

/** Opções do filtro "Responsável" da tela (o sistema atual não oferece "outro"). */
export const RESPONSAVEIS_DO_FILTRO = [
  "FR",
  "transportador",
  "destinatario",
  "cliente",
  "sistema",
  "pendente",
] as const;

export const RESPONSABILIDADES = ["todas", "penalizantes", "externas", "pendentes"] as const;
export type Responsabilidade = (typeof RESPONSABILIDADES)[number];

export const PRAZOS = ["no_prazo", "fora_prazo", "sem_prazo"] as const;
export type FiltroPrazo = (typeof PRAZOS)[number];

export const FAIXAS_ATRASO = ["ate_3", "de_4_8", "de_9_15", "de_16_30", "acima_30"] as const;
export type FaixaAtraso = (typeof FAIXAS_ATRASO)[number];

export const CAMPOS_DATA = ["emissao", "prevista"] as const;
export type CampoData = (typeof CAMPOS_DATA)[number];

export const ORDENS_DA_LISTA = [
  "data_hora",
  "codigo",
  "responsavel",
  "numero_ctrc",
  "parceiro_nome",
  "atraso_dias",
] as const;
export type OrdemDaLista = (typeof ORDENS_DA_LISTA)[number];

export const TAMANHOS_DE_PAGINA = [50, 100, 200] as const;

/** Rótulo do seletor de tipo para CT-e sem tipo de documento. */
export const SEM_TIPO_DOCUMENTO = "__SEM_TIPO__";

/** Filtros que escolhem os CT-e (valem para o painel, a lista e o "ver códigos"). */
export const filtrosDeCte = z.object({
  inicio: dataIso,
  fim: dataIso,
  campoData: z.enum(CAMPOS_DATA).default("emissao"),
  unidades: listaComTeto(z.uuid(), 100),
  conferentes: listaComTeto(z.string().trim().max(120), 500),
  parceiros: listaComTeto(z.string().regex(/^\d{1,14}$/, "CNPJ só com dígitos."), 500),
  filiais: listaComTeto(z.string().trim().toUpperCase().max(10), 100),
  remetente: z.string().max(2000).default(""),
  destino: z.string().max(2000).default(""),
  ctrc: z.string().max(60).default(""),
  nf: z.string().max(60).default(""),
  tipos: listaComTeto(z.string().max(80), 50),
});
export type FiltrosDeCte = z.infer<typeof filtrosDeCte>;

/** Recortes dos cards e blocos (valem para o painel e a lista, não para o "ver códigos"). */
export const recortes = z.object({
  codigos: listaComTeto(z.number().int().min(0).max(99), 100),
  responsaveis: listaComTeto(z.enum(RESPONSAVEIS_DO_FILTRO), RESPONSAVEIS_DO_FILTRO.length),
  responsabilidade: z.enum(RESPONSABILIDADES).default("todas"),
  prazo: z.enum(PRAZOS).nullable().default(null),
  faixaAtraso: z.enum(FAIXAS_ATRASO).nullable().default(null),
  pagador: z.string().max(300).nullable().default(null),
  unidadeResp: z.string().max(20).nullable().default(null),
});
export type Recortes = z.infer<typeof recortes>;

const contagemPorFaixa = z.object(
  Object.fromEntries(FAIXAS_ATRASO.map((f) => [f, z.number().int()])) as Record<
    FaixaAtraso,
    z.ZodNumber
  >,
);

const codigoNoPainel = z.object({
  codigo: z.number().int(),
  descricao: z.string(),
  responsavel: z.enum(RESPONSAVEIS_DO_EVENTO),
  penaliza: z.boolean(),
  pendente: z.boolean(),
});

export const painelDeOcorrencias = z.object({
  periodoAnterior: z.object({ inicio: z.string(), fim: z.string() }),
  /** Quantos códigos a tela acompanha (texto "recorte: N códigos de pendência"). */
  codigosAcompanhados: z.number().int(),
  metricas: z.object({
    total: z.number().int(),
    pendentes: z.number().int(),
    ctrcs: z.number().int(),
    penalizantes: z.number().int(),
    naoPenalizantes: z.number().int(),
  }),
  prazo: z.object({
    noPrazo: z.number().int(),
    foraPrazo: z.number().int(),
    semPrazo: z.number().int(),
  }),
  faixasAtraso: contagemPorFaixa,
  finalizacao: z.object({
    ctrcs: z.number().int(),
    entregues: z.number().int(),
    baixados: z.number().int(),
    emAberto: z.number().int(),
    emAtraso: z.number().int(),
  }),
  porPagador: z.array(z.object({ pagador: z.string(), ctrcs: z.number().int() })),
  topCodigos: z.array(
    codigoNoPainel.extend({
      count: z.number().int(),
      countAnterior: z.number().int(),
      delta: z.number().int(),
    }),
  ),
  ondeAtuar: z.array(
    z.object({
      unidade: z.string(),
      ocorrencias: z.number().int(),
      penalizantes: z.number().int(),
      pendentes: z.number().int(),
      ctrcs: z.number().int(),
    }),
  ),
  impacto: z.object({
    ctrcs: z.number().int(),
    ctrcsAnterior: z.number().int(),
    linhas: z.array(
      z.object({
        codigo: z.number().int(),
        descricao: z.string(),
        penaliza: z.boolean(),
        ocorrencias: z.number().int(),
        ocorrenciasAnterior: z.number().int(),
      }),
    ),
  }),
});
export type PainelDeOcorrencias = z.infer<typeof painelDeOcorrencias>;

export const linhaDeOcorrencia = z.object({
  id: z.uuid(),
  dataHora: z.string(),
  codigo: z.number().int(),
  descricao: z.string(),
  responsavel: z.enum(RESPONSAVEIS_DO_EVENTO),
  penaliza: z.boolean(),
  pendente: z.boolean(),
  cteId: z.uuid(),
  numeroCtrc: z.string(),
  siglaCtrc: z.string(),
  numeroNf: z.number().int().nullable(),
  dataEmissao: z.string(),
  unidadeResp: z.string().nullable(),
  pagador: z.string(),
  destinatario: z.string().nullable(),
  cidadeDestino: z.string().nullable(),
  ufDestino: z.string().nullable(),
  peso: z.number().nullable(),
  volumes: z.number().int().nullable(),
  valorFrete: z.number().nullable(),
  dataPrevistaEntrega: z.string().nullable(),
  setor: z.string().nullable(),
  atrasoDias: z.number().int().nullable(),
  conferente: z.string().nullable(),
  romaneio: z.string().nullable(),
});
export type LinhaDeOcorrencia = z.infer<typeof linhaDeOcorrencia>;

const filtrosDaLista = filtrosDeCte.extend(recortes.shape).extend({
  ordem: z.enum(ORDENS_DA_LISTA).default("data_hora"),
  direcao: z.enum(["asc", "desc"]).default("desc"),
});

export const CARDS = ["todas", "penalizantes", "externas", "pendentes"] as const;
export type Card = (typeof CARDS)[number];

export const codigoDoCard = codigoNoPainel.extend({
  total: z.number().int(),
  ctrcs: z.number().int(),
});
export type CodigoDoCard = z.infer<typeof codigoDoCard>;

export const contratosOcorrencias = {
  /** Consultas com listas de filtros vão no corpo (POST): a query string não comporta. */
  painel: contrato({
    metodo: "POST",
    caminho: "/api/v1/ocorrencias/painel",
    entrada: filtrosDeCte.extend(recortes.shape),
    saida: painelDeOcorrencias,
  }),
  lista: contrato({
    metodo: "POST",
    caminho: "/api/v1/ocorrencias/lista",
    entrada: filtrosDaLista.extend({
      ...paginacao({ maximo: 500 }),
    }),
    saida: z.object({ linhas: z.array(linhaDeOcorrencia), total: z.number().int() }),
  }),
  /** A lista detalhada inteira numa leitura só, na ordem da tela (até 200 mil linhas). */
  exportar: contrato({
    metodo: "POST",
    caminho: "/api/v1/ocorrencias/lista/exportacao",
    entrada: filtrosDaLista,
    saida: z.object({ linhas: z.array(linhaDeOcorrencia) }),
  }),
  codigosDoCard: contrato({
    metodo: "POST",
    caminho: "/api/v1/ocorrencias/codigos-do-card",
    entrada: filtrosDeCte.extend({ card: z.enum(CARDS) }),
    saida: z.object({ codigos: z.array(codigoDoCard) }),
  }),
  opcoes: contrato({
    metodo: "POST",
    caminho: "/api/v1/ocorrencias/opcoes",
    entrada: z.object({
      inicio: dataIso,
      fim: dataIso,
      unidades: listaComTeto(z.uuid(), 100),
      filiais: listaComTeto(z.string().trim().toUpperCase().max(10), 100),
    }),
    saida: z.object({
      unidades: z.array(
        z.object({
          id: z.uuid(),
          nome: z.string(),
          cidade: z.string().nullable(),
          uf: z.string().nullable(),
        }),
      ),
      parceiros: z.array(z.object({ id: z.string(), nome: z.string(), cnpjFormatado: z.string() })),
      codigos: z.array(z.object({ codigo: z.number().int(), descricao: z.string() })),
    }),
  }),
  conferentes: contrato({
    metodo: "GET",
    caminho: "/api/v1/ocorrencias/conferentes",
    saida: z.object({ conferentes: z.array(z.string()) }),
  }),
} as const;
