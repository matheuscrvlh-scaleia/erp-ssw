/**
 * Contratos da tela Prazo do parceiro (visão geral, lista e detalhe).
 * Spec: docs/regras/03-romaneio-prazo-parceiro.md §6.
 */
import { contrato } from "@erp/shared/contract";
import { dataIso, paginacao } from "@erp/shared/query";
import { z } from "@erp/shared/zod";

export const filtrosPrazo = z
  .object({
    inicio: dataIso,
    fim: dataIso,
    unidades: z.array(z.uuid()).max(200).optional(),
    parceiros: z.array(z.uuid()).max(500).optional(),
    tipos: z.array(z.string().trim().min(1).max(60)).max(100).optional(),
  })
  .refine((f) => f.inicio <= f.fim, {
    message: "O início do período é depois do fim.",
    path: ["fim"],
  });
export type FiltrosPrazo = z.infer<typeof filtrosPrazo>;

export const FILTROS_DA_LISTA = ["nascidos", "prazo_parceiro", "todos"] as const;
export type FiltroDaLista = (typeof FILTROS_DA_LISTA)[number];

export const TAMANHOS_DA_LISTA = [50, 100, 200] as const;
/** Teto da exportação da lista (o selo da tela diz este número). */
export const LIMITE_EXPORTACAO_PRAZO = 20_000;
/** Teto da lista de nascidos em atraso do detalhe. */
export const LIMITE_NASCIDOS_DETALHE = 500;

/** Detalhe por cadastro (uuid) ou pelo CNPJ de parceiro sem cadastro (`cnpj:<dígitos>`, Q08). */
const idDoParceiro = z.union([z.uuid(), z.string().regex(/^cnpj:\d{8,14}$/)]);

const sla = z.object({ meta: z.number(), alerta: z.number() });

const linhaDaLista = z.object({
  id: z.uuid(),
  sigla: z.string(),
  numero: z.string(),
  parceiroNome: z.string().nullable(),
  /** Para o link do CT-e no SSW. */
  dataEmissao: z.string(),
  dataEmbarque: z.string().nullable(),
  dataPrevista: z.string().nullable(),
  prazoPadraoData: z.string().nullable(),
  diasAbaixoDoPadrao: z.number().nullable(),
  nasceuAtrasado: z.boolean(),
  prazoOrigem: z.enum(["proprio", "parceiro"]),
  statusAtual: z.string().nullable(),
  setor: z.string().nullable(),
  unidadeNome: z.string().nullable(),
});
export type LinhaPrazo = z.infer<typeof linhaDaLista>;

const nascido = z.object({
  id: z.uuid(),
  sigla: z.string(),
  numero: z.string(),
  dataEmbarque: z.string().nullable(),
  dataEmissao: z.string(),
  dataPrevista: z.string().nullable(),
  prazoPadraoData: z.string().nullable(),
  diasAbaixoDoPadrao: z.number().nullable(),
  statusAtual: z.string().nullable(),
  setor: z.string().nullable(),
  unidadeNome: z.string().nullable(),
  cidadeDestino: z.string().nullable(),
  ufDestino: z.string().nullable(),
});
export type NascidoAtrasado = z.infer<typeof nascido>;

const totais = z.object({
  totalCtes: z.number(),
  totalProprio: z.number(),
  totalParceiro: z.number(),
  nascidosAtrasados: z.number(),
  nascidosAvaliados: z.number(),
  pctNascidos: z.number().nullable(),
  performanceTotal: z.number(),
  performancePropria: z.number(),
  diferencaPp: z.number(),
  pctPrazoProprio: z.number(),
  pctPrazoParceiro: z.number(),
});

export const contratosPrazoParceiro = {
  visaoGeral: contrato({
    metodo: "POST",
    caminho: "/api/v1/prazo-parceiro/visao-geral",
    entrada: filtrosPrazo,
    saida: z.object({
      totais,
      comparacao: z.object({ deltaNascidos: z.number(), deltaGapPp: z.number().nullable() }),
      ranking: z.array(
        z.object({
          id: z.string(),
          nome: z.string(),
          usaSsw: z.boolean().nullable(),
          total: z.number(),
          qtdParceiro: z.number(),
          pctParceiro: z.number(),
          nascidosAtrasados: z.number(),
          pctNascidos: z.number(),
          performanceComParceiro: z.number(),
        }),
      ),
      sla,
    }),
  }),
  opcoes: contrato({
    metodo: "GET",
    caminho: "/api/v1/prazo-parceiro/opcoes",
    /** Período da tela: os tipos de documento são os que aparecem nele. */
    entrada: z.object({ inicio: dataIso, fim: dataIso }),
    saida: z.object({
      unidades: z.array(z.object({ id: z.uuid(), nome: z.string() })),
      parceiros: z.array(z.object({ id: z.uuid(), nome: z.string() })),
      /** Em maiúsculas; `__SEM_TIPO__` = sem tipo. */
      tipos: z.array(z.string()),
    }),
  }),
  lista: contrato({
    metodo: "POST",
    caminho: "/api/v1/prazo-parceiro/lista",
    entrada: z.object({
      filtros: filtrosPrazo,
      filtro: z.enum(FILTROS_DA_LISTA).default("nascidos"),
      ...paginacao({ opcoes: TAMANHOS_DA_LISTA }),
    }),
    saida: z.object({ linhas: z.array(linhaDaLista), total: z.number() }),
  }),
  exportar: contrato({
    metodo: "POST",
    caminho: "/api/v1/prazo-parceiro/lista/exportar",
    entrada: z.object({
      filtros: filtrosPrazo,
      filtro: z.enum(FILTROS_DA_LISTA).default("nascidos"),
    }),
    saida: z.object({ linhas: z.array(linhaDaLista), truncada: z.boolean() }),
  }),
  detalhe: contrato({
    metodo: "POST",
    caminho: "/api/v1/prazo-parceiro/parceiros/:id",
    parametros: z.object({ id: idDoParceiro }),
    entrada: filtrosPrazo,
    saida: z.object({
      parceiro: z.object({ nome: z.string(), prazoAcordoHoras: z.number().nullable() }),
      resumo: totais,
      histograma: z.array(z.object({ faixa: z.string(), qtd: z.number() })),
      nascidos: z.array(nascido),
      sla,
    }),
  }),
} as const;
