import { dataIso } from "@erp/shared/consulta";
import { contrato } from "@erp/shared/contrato";
import { diferencaEmDias, ehDataIso } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";

const parametrosId = z.object({ id: z.uuid() });
const ok = z.object({ ok: z.literal(true) });
const textoOpcional = z.string().trim().max(500).nullish();

/* ============== Ranking operacional (/ranking) ============== */

export const BASES_DO_RANKING = ["emissao", "prevista", "concluido"] as const;

export const linhaDoRanking = z.object({
  chave: z.string(),
  rotulo: z.string().nullable(),
  sub: z.string().nullable(),
  totalCtes: z.number().int(),
  entregue: z.number().int(),
  noPrazo: z.number().int(),
  foraPrazo: z.number().int(),
  foraCliente: z.number().int(),
  foraTransp: z.number().int(),
  /** Fração 0–1. */
  slaPct: z.number().nullable(),
  aEntregar: z.number().int(),
  atrasadas: z.number().int(),
  noPrazoAberto: z.number().int(),
  peso: z.number(),
  volumes: z.number(),
  frete: z.number(),
});

export type LinhaDoRanking = z.infer<typeof linhaDoRanking>;

const filtroDoRanking = z.object({
  grupo: z.enum(["pagador", "cidade"]),
  inicio: dataIso,
  fim: dataIso,
  baseData: z.enum(BASES_DO_RANKING).default("emissao"),
  filiais: z.array(z.string().max(20)).max(100).nullish(),
  /** CNPJ do pagador, só dígitos. */
  pagadores: z.array(z.string().max(20)).max(500).nullish(),
  /** Vários valores separados por "|". */
  destino: textoOpcional,
  remetente: textoOpcional,
  /** "__SEM_TIPO__" = CT-e sem tipo de documento. */
  tipos: z.array(z.string().max(60)).max(50).nullish(),
});

export type FiltroDoRanking = z.input<typeof filtroDoRanking>;

/* ============== Equipes (/admin/equipes) ============== */

export const PAPEIS_DE_MEMBRO = ["motorista", "ajudante"] as const;

export const equipe = z.object({
  id: z.uuid(),
  nome: z.string(),
  unidadeId: z.uuid().nullable(),
  ativo: z.boolean(),
  /** Há link público válido. O token em si só aparece uma vez, ao gerar. */
  linkAtivo: z.boolean(),
});

export const membro = z.object({
  id: z.uuid(),
  equipeId: z.uuid(),
  nome: z.string(),
  papel: z.enum(PAPEIS_DE_MEMBRO),
  cpf: z.string().nullable(),
  posicao: z.number().int().nullable(),
});

export type Equipe = z.infer<typeof equipe>;
export type Membro = z.infer<typeof membro>;

const unidade = z.object({ id: z.uuid(), nome: z.string() });

export const cteParaAtribuir = z.object({
  id: z.uuid(),
  sigla: z.string(),
  numero: z.string(),
  dataEmissao: z.string(),
  cidadeDestino: z.string().nullable(),
  ufDestino: z.string().nullable(),
  motoristaNome: z.string().nullable(),
});

/* ============== Regras de bonificação (/ranking/regras) ============== */

export const CRITERIOS_DE_REGRA = [
  "entregas_prazo",
  "penalizante",
  "meta_produtividade",
  "piso_performance",
  "livre",
] as const;

export type CriterioDeRegra = (typeof CRITERIOS_DE_REGRA)[number];

const valor = z.number();

/** Parâmetros aceitos por critério (o editor converte o texto digitado em número). */
const criterioDaRegra = z.discriminatedUnion("criterio", [
  z.object({ criterio: z.literal("entregas_prazo"), parametros: z.object({ peso: valor }) }),
  z.object({ criterio: z.literal("penalizante"), parametros: z.object({ valor }) }),
  z.object({
    criterio: z.literal("meta_produtividade"),
    parametros: z.object({ meta_entregas: valor, bonus_se_atingir: valor }),
  }),
  z.object({
    criterio: z.literal("piso_performance"),
    parametros: z.object({ performance_minima: valor }),
  }),
  z.object({
    criterio: z.literal("livre"),
    parametros: z.object({ nome: z.string().trim().max(120), valor }),
  }),
]);

export const regra = z.object({
  id: z.uuid(),
  nome: z.string(),
  descricao: z.string().nullable(),
  vigenciaInicio: z.string(),
  vigenciaFim: z.string().nullable(),
  ativo: z.boolean(),
  criterios: z.array(
    z.object({
      id: z.uuid(),
      criterio: z.enum(CRITERIOS_DE_REGRA),
      parametros: z.record(z.string(), z.union([z.string(), z.number()])),
      ordem: z.number().int(),
    }),
  ),
});

export type Regra = z.infer<typeof regra>;

const itemDoCalculo = z.object({
  criterio: z.enum(CRITERIOS_DE_REGRA),
  label: z.string(),
  detalhe: z.string(),
  subtotal: z.number(),
});

export const calculoDaEquipe = z.object({
  equipeId: z.uuid(),
  regraId: z.uuid(),
  periodoInicio: z.string(),
  periodoFim: z.string(),
  totalEntregas: z.number().int(),
  entregasNoPrazo: z.number().int(),
  penalizantes: z.number().int(),
  performance: z.number(),
  pontos: z.number().int(),
  valorCalculado: z.number(),
  zeradoPorPiso: z.boolean(),
  breakdown: z.array(itemDoCalculo),
});

export type CalculoDaEquipe = z.infer<typeof calculoDaEquipe>;

const periodo = z
  .object({ inicio: dataIso, fim: dataIso })
  .refine((p) => p.fim >= p.inicio, "Data final deve ser maior ou igual à data inicial")
  .refine(
    (p) => !ehDataIso(p.inicio) || !ehDataIso(p.fim) || diferencaEmDias(p.inicio, p.fim) <= 366,
    "Escolha um período de no máximo um ano.",
  );

export const contratosRanking = {
  operacional: contrato({
    metodo: "POST",
    caminho: "/api/v1/ranking/operacional",
    entrada: filtroDoRanking,
    saida: z.array(linhaDoRanking),
  }),

  equipes: contrato({
    metodo: "GET",
    caminho: "/api/v1/ranking/equipes",
    saida: z.object({
      equipes: z.array(equipe),
      membros: z.array(membro),
      unidades: z.array(unidade),
    }),
  }),
  salvarEquipe: contrato({
    metodo: "POST",
    caminho: "/api/v1/ranking/equipes",
    entrada: z.object({
      id: z.uuid().optional(),
      nome: z.string().trim().min(1, "Informe o nome da equipe.").max(120),
      unidadeId: z.uuid().nullish(),
      ativo: z.boolean().default(true),
    }),
    saida: z.object({ id: z.uuid() }),
  }),
  incluirMembro: contrato({
    metodo: "POST",
    caminho: "/api/v1/ranking/equipes/:id/membros",
    parametros: parametrosId,
    entrada: z.object({
      nome: z.string().trim().min(1, "Informe o nome do membro.").max(120),
      papel: z.enum(PAPEIS_DE_MEMBRO),
      cpf: z.string().trim().max(20).nullish(),
      posicao: z.number().int().min(1).max(3).nullish(),
    }),
    saida: ok,
  }),
  removerMembro: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/ranking/membros/:id",
    parametros: parametrosId,
    saida: ok,
  }),
  gerarLink: contrato({
    metodo: "POST",
    caminho: "/api/v1/ranking/equipes/:id/link",
    parametros: parametrosId,
    saida: z.object({ token: z.string() }),
  }),
  revogarLink: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/ranking/equipes/:id/link",
    parametros: parametrosId,
    saida: ok,
  }),
  ctesParaAtribuir: contrato({
    metodo: "GET",
    caminho: "/api/v1/ranking/atribuicao",
    entrada: z.object({
      inicio: dataIso,
      fim: dataIso,
      somenteSemEquipe: z
        .enum(["true", "false"])
        .default("true")
        .transform((v) => v === "true"),
      unidadeId: z.uuid().optional(),
    }),
    saida: z.object({ ctes: z.array(cteParaAtribuir) }),
  }),
  atribuir: contrato({
    metodo: "POST",
    caminho: "/api/v1/ranking/atribuicao",
    entrada: z.object({
      cteIds: z.array(z.uuid()).min(1, "Selecione ao menos um CT-e.").max(500),
      equipeId: z.uuid().nullable(),
    }),
    saida: z.object({ quantidade: z.number().int() }),
  }),

  regras: contrato({
    metodo: "GET",
    caminho: "/api/v1/ranking/regras",
    saida: z.array(regra),
  }),
  salvarRegra: contrato({
    metodo: "POST",
    caminho: "/api/v1/ranking/regras",
    entrada: z
      .object({
        id: z.uuid().optional(),
        nome: z.string().trim().min(1, "Informe o nome da regra.").max(120),
        descricao: z.string().trim().max(500).nullish(),
        vigenciaInicio: dataIso,
        vigenciaFim: dataIso.nullish(),
        ativo: z.boolean().default(true),
        criterios: z.array(criterioDaRegra).max(20).default([]),
      })
      .refine(
        (r) => !r.vigenciaFim || r.vigenciaFim >= r.vigenciaInicio,
        "A vigência final deve ser igual ou posterior à inicial.",
      ),
    saida: z.object({ id: z.uuid() }),
  }),
  excluirRegra: contrato({
    metodo: "DELETE",
    caminho: "/api/v1/ranking/regras/:id",
    parametros: parametrosId,
    saida: ok,
  }),
  simularRegra: contrato({
    metodo: "GET",
    caminho: "/api/v1/ranking/regras/:id/simulacao",
    parametros: parametrosId,
    entrada: periodo,
    saida: z.object({
      periodoInicio: z.string(),
      periodoFim: z.string(),
      regraId: z.uuid(),
      equipes: z.array(
        calculoDaEquipe.extend({
          nome: z.string(),
          unidadeId: z.uuid().nullable(),
          unidadeNome: z.string().nullable(),
          membros: z.array(z.object({ nome: z.string(), papel: z.enum(PAPEIS_DE_MEMBRO) })),
        }),
      ),
    }),
  }),
  calculoDaEquipe: contrato({
    metodo: "GET",
    caminho: "/api/v1/ranking/equipes/:id/calculo",
    parametros: parametrosId,
    entrada: z
      .object({ inicio: dataIso, fim: dataIso, regra: z.uuid() })
      .refine((p) => p.fim >= p.inicio, "Data final deve ser maior ou igual à data inicial"),
    saida: z.object({
      equipeNome: z.string(),
      totalEquipes: z.number().int(),
      calculo: calculoDaEquipe,
    }),
  }),

  /** Link público (sem login): `/ranking/publico/<token>`. */
  publico: contrato({
    metodo: "GET",
    caminho: "/api/public/ranking/:token",
    parametros: z.object({ token: z.string().regex(/^[0-9a-f]{48}$/, "Link inválido.") }),
    entrada: periodo.refine(
      (p) => !ehDataIso(p.inicio) || !ehDataIso(p.fim) || diferencaEmDias(p.inicio, p.fim) <= 31,
      "Período inválido.",
    ),
    saida: z.object({
      equipe: z.object({ id: z.uuid(), nome: z.string() }),
      periodo: z.object({ inicio: z.string(), fim: z.string() }),
      calculo: calculoDaEquipe,
      posicao: z.number().int().nullable(),
      totalEquipes: z.number().int(),
      top3: z.array(z.object({ posicao: z.number().int(), nome: z.string() })),
    }),
  }),
} as const;
