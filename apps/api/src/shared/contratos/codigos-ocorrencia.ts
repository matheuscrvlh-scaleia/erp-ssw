import { contrato } from "../contrato";
import { z } from "../zod";
import { RESPONSAVEIS } from "./ocorrencias";

/** Letra do responsável no SSW: F = FR, C = cliente, D = destinatário, T, S, O. */
export const LETRAS_DE_RESPONSAVEL = ["F", "C", "D", "T", "S", "O"] as const;
export type LetraDeResponsavel = (typeof LETRAS_DE_RESPONSAVEL)[number];

export const ACOES_EM_LOTE = ["ativar", "desativar", "penaliza_true", "penaliza_false"] as const;
export type AcaoEmLote = (typeof ACOES_EM_LOTE)[number];

const numeroDoCodigo = z.coerce.number().int().min(0).max(99);

export const codigoDoAdmin = z.object({
  codigo: z.number().int(),
  descricao: z.string(),
  responsavel: z.enum(RESPONSAVEIS),
  penaliza: z.boolean(),
  letraResponsavel: z.string().nullable(),
  ativo: z.boolean(),
  pendenteClassificacao: z.boolean(),
  notas: z.string().nullable(),
  tipoSsw: z.string().nullable(),
  processoSsw: z.string().nullable(),
  atualizadoEm: z.string(),
  atualizadoPorNome: z.string().nullable(),
  /** Ocorrências do código nos últimos 30 dias (contagem real, Q04 do dono). */
  frequencia30d: z.number().int(),
});
export type CodigoDoAdmin = z.infer<typeof codigoDoAdmin>;

export const estatisticasDoCatalogo = z.object({
  total: z.number().int(),
  classificados: z.number().int(),
  pendentes: z.number().int(),
  ocorrenciasEmPendentes: z.number().int(),
  /** 1 − ocorrências em códigos pendentes ÷ ocorrências (30 dias); 1 sem ocorrência. */
  precisao: z.number(),
});
export type EstatisticasDoCatalogo = z.infer<typeof estatisticasDoCatalogo>;

export const ACOES_DO_HISTORICO = [
  "criou",
  "excluiu",
  "editou",
  "classificou",
  "desativou",
  "reativou",
] as const;

export const alteracaoDoCodigo = z.object({
  id: z.string(),
  criadoEm: z.string(),
  acao: z.enum(ACOES_DO_HISTORICO),
  campo: z.string().nullable(),
  valorAntigo: z.string().nullable(),
  valorNovo: z.string().nullable(),
  autorNome: z.string().nullable(),
});
export type AlteracaoDoCodigo = z.infer<typeof alteracaoDoCodigo>;

export const contratosCodigosOcorrencia = {
  listar: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/codigos",
    saida: z.object({ codigos: z.array(codigoDoAdmin), estatisticas: estatisticasDoCatalogo }),
  }),
  historico: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/codigos/:codigo/historico",
    parametros: z.object({ codigo: numeroDoCodigo }),
    saida: z.object({ alteracoes: z.array(alteracaoDoCodigo) }),
  }),
  salvar: contrato({
    metodo: "PUT",
    caminho: "/api/v1/admin/codigos/:codigo",
    parametros: z.object({ codigo: numeroDoCodigo }),
    entrada: z.object({
      descricao: z.string().trim().min(3, "Descrição (mín. 3 caracteres)").max(500),
      letra: z.enum(LETRAS_DE_RESPONSAVEL),
      penaliza: z.boolean(),
      ativo: z.boolean().default(true),
      notas: z.string().max(2000).nullable().default(null),
    }),
    saida: z.object({
      /** Ocorrências do código (a classificação nova vale para todas, inclusive as antigas). */
      afetadas: z.number().int(),
    }),
  }),
  lote: contrato({
    metodo: "POST",
    caminho: "/api/v1/admin/codigos/lote",
    entrada: z.object({
      codigos: z.array(z.number().int().min(0).max(99)).min(1).max(100),
      acao: z.enum(ACOES_EM_LOTE),
    }),
    saida: z.object({ alterados: z.number().int() }),
  }),
} as const;
