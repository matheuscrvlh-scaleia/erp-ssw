import {
  type FiltrosAuditoria,
  type FiltrosIntegracao,
  LIMITE_AUDITORIA,
  LIMITE_INTEGRACAO_POR_ORIGEM,
  type LinhaAuditoria,
  type LinhaIntegracao,
  ORIGENS_INTEGRACAO,
  type OrigemIntegracao,
} from "@erp/shared/contratos/auditoria";

import { type Executor } from "../../repositorios";

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

export interface Execucao {
  id: string;
  quando: Date;
  status: string | null;
  erro: string | null;
  /** Números e textos crus de cada origem; o resumo é montado aqui. */
  dados: Record<string, string | number | boolean | null>;
}

export interface RepositorioLogs {
  auditoria(
    filtro: FiltroDeAuditoria,
  ): Promise<(Omit<LinhaAuditoria, "criadoEm"> & { criadoEm: Date })[]>;
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
): Promise<{ linhas: LinhaAuditoria[]; limite: number }> {
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
  return {
    linhas: linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() })),
    limite: LIMITE_AUDITORIA,
  };
}

const n = (valor: unknown) => (typeof valor === "number" ? valor : 0);
const t = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);

/** Uma linha de texto por execução, como a tela de hoje mostra. */
export function resumoDaExecucao(origem: OrigemIntegracao, d: Execucao["dados"]): string {
  switch (origem) {
    case "sftp_xml": {
      const erros = n(d["arquivosComErro"]);
      const quem = t(d["disparadoPor"]);
      return `${n(d["arquivosProcessados"])} arquivo(s), ${n(d["ctesProcessados"])} CT-e${
        erros > 0 ? `, ${erros} com erro` : ""
      }${quem ? ` · ${quem}` : ""}`;
    }
    case "relatorio_ssw": {
      const linhas = n(d["linhas"]);
      return `${t(d["relatorio"]) ?? "?"} · ${t(d["nomeArquivo"]) ?? ""}${
        linhas > 0 ? ` · ${linhas} linha(s)` : ""
      }`;
    }
    case "aplicacao_ssw":
      return `${n(d["inseridos"])} inserido(s), ${n(d["atualizados"])} atualizado(s), ${n(
        d["ocorrencias"],
      )} ocorrência(s), ${n(d["ignorados"])} ignorado(s)${d["simulacao"] === true ? " · simulação" : ""}`;
    case "bi2": {
      const modo = t(d["modo"]);
      return `Relatório ${t(d["codigo"]) ?? "—"} de ${t(d["dataAlvo"]) ?? "—"}${
        modo ? ` (${modo})` : ""
      }: ${n(d["linhas"])} linha(s), ${n(d["criados"])} criado(s), ${n(d["atualizados"])} atualizado(s)`;
    }
  }
}

/** Até 250 execuções por origem, juntas e da mais recente para a mais antiga. */
export async function listarIntegracoes(
  db: Executor<"logs">,
  empresaId: string,
  filtros: FiltrosIntegracao,
): Promise<{ linhas: LinhaIntegracao[] }> {
  const origens = filtros.origem ? [filtros.origem] : ORIGENS_INTEGRACAO;
  const porOrigem = await db(async ({ logs }) => {
    const resultado: { origem: OrigemIntegracao; execucoes: Execucao[] }[] = [];
    for (const origem of origens) {
      resultado.push({
        origem,
        execucoes: await logs.execucoes(
          empresaId,
          origem,
          periodo(filtros),
          LIMITE_INTEGRACAO_POR_ORIGEM,
        ),
      });
    }
    return resultado;
  });
  const linhas = porOrigem
    .flatMap(({ origem, execucoes }) =>
      execucoes.map((e) => ({
        id: `${origem}:${e.id}`,
        origem,
        quando: e.quando,
        status: e.status,
        resumo: resumoDaExecucao(origem, e.dados),
        erro: e.erro,
      })),
    )
    .sort((a, b) => b.quando.getTime() - a.quando.getTime());
  return { linhas: linhas.map((l) => ({ ...l, quando: l.quando.toISOString() })) };
}
