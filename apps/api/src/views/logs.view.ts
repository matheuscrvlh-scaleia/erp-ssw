import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosAuditoria, type OrigemIntegracao } from "@erp/shared/contratos/auditoria";

import {
  type AlteracaoGravada,
  type Execucao,
  type ExecucaoDaOrigem,
} from "../models/logs/logs.service";

export function apresentarAlteracoes(alteracoes: {
  linhas: readonly AlteracaoGravada[];
  limite: number;
}): SaidaDe<typeof contratosAuditoria.alteracoesDaEmpresa> {
  return {
    linhas: alteracoes.linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() })),
    limite: alteracoes.limite,
  };
}

const n = (valor: unknown) => (typeof valor === "number" ? valor : 0);
const t = (valor: unknown) => (typeof valor === "string" && valor ? valor : null);

/** Uma linha de texto por execução, como a tela de hoje mostra. */
function resumoDaExecucao(origem: OrigemIntegracao, d: Execucao["dados"]): string {
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

/** As origens juntas, da execução mais recente para a mais antiga. */
export function apresentarIntegracoes(
  execucoes: readonly ExecucaoDaOrigem[],
): SaidaDe<typeof contratosAuditoria.integracoesDaEmpresa> {
  return {
    linhas: [...execucoes]
      .sort((a, b) => b.quando.getTime() - a.quando.getTime())
      .map((e) => ({
        id: `${e.origem}:${e.id}`,
        origem: e.origem,
        quando: e.quando.toISOString(),
        status: e.status,
        resumo: resumoDaExecucao(e.origem, e.dados),
        erro: e.erro,
      })),
  };
}
