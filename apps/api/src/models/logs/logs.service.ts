import {
  type FiltrosAuditoria,
  type FiltrosIntegracao,
  LIMITE_AUDITORIA,
  LIMITE_INTEGRACAO_POR_ORIGEM,
  type LinhaAuditoria,
  type OrigemIntegracao,
  ORIGENS_INTEGRACAO,
} from "@erp/shared/contratos/auditoria";

import { type Executor } from "../repositorios";

/*
 * Telas de Logs: Alterações (trilha de auditoria) e Integrações (execuções da ingestão).
 * origem: listarAuditoriaEmpresa, listarAuditoriaPlataforma, listarLogsIntegracao (sistema atual)
 */

/** De quem são os registros: uma empresa, só os sem empresa (Plataforma) ou todos. */
export type EscopoDosLogs =
  { tipo: "empresa"; empresaId: string } | { tipo: "plataforma" } | { tipo: "todas" };

export interface FiltroDeAuditoria {
  escopo: EscopoDosLogs;
  /** Trecho do e-mail de quem fez (sem diferença de maiúsculas). */
  ator: string | null;
  entidade: string | null;
  acao: string | null;
  de: Date | null;
  ate: Date | null;
  limite: number;
}

export type AlteracaoGravada = Omit<LinhaAuditoria, "criadoEm"> & { criadoEm: Date };

export interface Execucao {
  id: string;
  quando: Date;
  status: string | null;
  erro: string | null;
  /** Números e textos crus de cada origem; o resumo para a tela é montado na view. */
  dados: Record<string, string | number | boolean | null>;
}

export interface RepositorioLogs {
  auditoria(filtro: FiltroDeAuditoria): Promise<AlteracaoGravada[]>;
  execucoes(
    empresaId: string,
    origem: OrigemIntegracao,
    periodo: { de: Date | null; ate: Date | null },
    limite: number,
  ): Promise<Execucao[]>;
}

/** Período por dia de Brasília: do começo do `de` ao fim do `ate`. */
function periodo(filtros: { de?: string | undefined; ate?: string | undefined }) {
  return {
    de: filtros.de ? new Date(`${filtros.de}T00:00:00-03:00`) : null,
    ate: filtros.ate ? new Date(`${filtros.ate}T23:59:59.999-03:00`) : null,
  };
}

const vazioParaNulo = (texto: string | undefined) => (texto ? texto : null);

export async function listarAlteracoes(
  db: Executor<"logs">,
  escopo: EscopoDosLogs,
  filtros: FiltrosAuditoria,
): Promise<{ linhas: AlteracaoGravada[]; limite: number }> {
  const linhas = await db(({ logs }) =>
    logs.auditoria({
      escopo,
      ator: vazioParaNulo(filtros.ator),
      entidade: vazioParaNulo(filtros.entidade),
      acao: vazioParaNulo(filtros.acao),
      ...periodo(filtros),
      limite: LIMITE_AUDITORIA,
    }),
  );
  return { linhas, limite: LIMITE_AUDITORIA };
}

export interface ExecucaoDaOrigem extends Execucao {
  origem: OrigemIntegracao;
}

/** Até 250 execuções por origem (a pedida ou todas). */
export async function listarIntegracoes(
  db: Executor<"logs">,
  empresaId: string,
  filtros: FiltrosIntegracao,
): Promise<ExecucaoDaOrigem[]> {
  const origens = filtros.origem ? [filtros.origem] : ORIGENS_INTEGRACAO;
  return db(async ({ logs }) => {
    const execucoes: ExecucaoDaOrigem[] = [];
    for (const origem of origens) {
      const daOrigem = await logs.execucoes(
        empresaId,
        origem,
        periodo(filtros),
        LIMITE_INTEGRACAO_POR_ORIGEM,
      );
      execucoes.push(...daOrigem.map((e) => ({ ...e, origem })));
    }
    return execucoes;
  });
}
