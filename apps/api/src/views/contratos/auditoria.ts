import { contrato } from "@erp/shared/contrato";
import { ehDataIso } from "@erp/shared/datas";
import { z } from "@erp/shared/zod";

/*
 * Logs: aba Alterações (trilha de auditoria) e aba Integrações (execuções da ingestão).
 * Admin › Logs lê a empresa ativa; Plataforma › Logs lê todas (ou uma).
 * origem: src/features/auditoria (sistema atual)
 */

export const TIPOS_DE_ATOR = ["usuario", "plataforma", "sistema", "integracao"] as const;

/** A tela avisa quando a lista bate no limite. */
export const LIMITE_AUDITORIA = 1000;
/** Linhas por origem na aba Integrações. */
export const LIMITE_INTEGRACAO_POR_ORIGEM = 250;

export const ORIGENS_INTEGRACAO = ["sftp_xml", "relatorio_ssw", "aplicacao_ssw", "bi2"] as const;
export type OrigemIntegracao = (typeof ORIGENS_INTEGRACAO)[number];

export const linhaAuditoria = z.object({
  id: z.number().int(),
  empresaId: z.uuid().nullable(),
  empresaNome: z.string().nullable(),
  atorEmail: z.string().nullable(),
  atorTipo: z.enum(TIPOS_DE_ATOR),
  acao: z.string(),
  entidade: z.string(),
  entidadeId: z.string().nullable(),
  resumo: z.string().nullable(),
  antes: z.record(z.string(), z.unknown()).nullable(),
  depois: z.record(z.string(), z.unknown()).nullable(),
  ip: z.string().nullable(),
  criadoEm: z.iso.datetime(),
});
export type LinhaAuditoria = z.infer<typeof linhaAuditoria>;

export const linhaIntegracao = z.object({
  id: z.string(),
  origem: z.enum(ORIGENS_INTEGRACAO),
  quando: z.iso.datetime(),
  status: z.string().nullable(),
  resumo: z.string(),
  erro: z.string().nullable(),
});
export type LinhaIntegracao = z.infer<typeof linhaIntegracao>;

const dia = z.string().refine(ehDataIso, "Data inválida (use AAAA-MM-DD).").optional();
const textoDeFiltro = z.string().trim().max(120).optional();

const filtrosAuditoria = z.object({
  ator: textoDeFiltro,
  entidade: textoDeFiltro,
  acao: textoDeFiltro,
  de: dia,
  ate: dia,
});
export type FiltrosAuditoria = z.infer<typeof filtrosAuditoria>;

const filtrosIntegracao = z.object({
  origem: z.enum(ORIGENS_INTEGRACAO).optional(),
  de: dia,
  ate: dia,
});
export type FiltrosIntegracao = z.infer<typeof filtrosIntegracao>;

/** Empresa nos logs da Plataforma: uma empresa ou "plataforma" (ações sem empresa). */
export const filtroDeEmpresa = z.union([z.uuid(), z.literal("plataforma")]).optional();

const saidaAuditoria = z.object({ linhas: z.array(linhaAuditoria), limite: z.number().int() });
const saidaIntegracao = z.object({ linhas: z.array(linhaIntegracao) });

export const contratosAuditoria = {
  alteracoesDaEmpresa: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/logs/alteracoes",
    entrada: filtrosAuditoria,
    saida: saidaAuditoria,
  }),
  integracoesDaEmpresa: contrato({
    metodo: "GET",
    caminho: "/api/v1/admin/logs/integracoes",
    entrada: filtrosIntegracao,
    saida: saidaIntegracao,
  }),
  alteracoesDaPlataforma: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/logs/alteracoes",
    entrada: filtrosAuditoria.extend({ empresa: filtroDeEmpresa }),
    saida: saidaAuditoria,
  }),
  integracoesDeEmpresaNaPlataforma: contrato({
    metodo: "GET",
    caminho: "/api/v1/plataforma/empresas/:id/logs/integracoes",
    parametros: z.object({ id: z.uuid() }),
    entrada: filtrosIntegracao,
    saida: saidaIntegracao,
  }),
} as const;
