import { type Transacao } from "@erp/db";
import {
  auditoria,
  bi2Sincronizacoes,
  empresas,
  ingestaoAplicacoes,
  ingestaoArquivos,
  xmlFtpSincronizacoes,
} from "@erp/db/schema";
import { and, type AnyColumn, desc, eq, gte, ilike, isNull, lte, type SQL } from "drizzle-orm";

import { type EscopoDosLogs, type Execucao, type RepositorioLogs } from "./casos-de-uso";

/** `%` e `_` digitados são texto, não curinga. */
function trecho(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function doEscopo(escopo: EscopoDosLogs): SQL | undefined {
  if (escopo.tipo === "empresa") return eq(auditoria.empresaId, escopo.empresaId);
  if (escopo.tipo === "plataforma") return isNull(auditoria.empresaId);
  return undefined;
}

function noPeriodo(coluna: AnyColumn, periodo: { de: Date | null; ate: Date | null }) {
  return [
    periodo.de ? gte(coluna, periodo.de) : undefined,
    periodo.ate ? lte(coluna, periodo.ate) : undefined,
  ];
}

export function criarRepositorioLogs(tx: Transacao): RepositorioLogs {
  return {
    auditoria: (f) =>
      tx
        .select({
          id: auditoria.id,
          empresaId: auditoria.empresaId,
          empresaNome: empresas.nome,
          atorEmail: auditoria.atorEmail,
          atorTipo: auditoria.atorTipo,
          acao: auditoria.acao,
          entidade: auditoria.entidade,
          entidadeId: auditoria.entidadeId,
          resumo: auditoria.resumo,
          antes: auditoria.antes,
          depois: auditoria.depois,
          ip: auditoria.ip,
          criadoEm: auditoria.criadoEm,
        })
        .from(auditoria)
        .leftJoin(empresas, eq(empresas.id, auditoria.empresaId))
        .where(
          and(
            doEscopo(f.escopo),
            f.ator ? ilike(auditoria.atorEmail, trecho(f.ator)) : undefined,
            f.entidade ? eq(auditoria.entidade, f.entidade) : undefined,
            f.acao ? eq(auditoria.acao, f.acao) : undefined,
            ...noPeriodo(auditoria.criadoEm, f),
          ),
        )
        .orderBy(desc(auditoria.criadoEm), desc(auditoria.id))
        .limit(f.limite),

    execucoes: async (empresaId, origem, periodo, limite): Promise<Execucao[]> => {
      if (origem === "sftp_xml") {
        const t = xmlFtpSincronizacoes;
        const linhas = await tx
          .select()
          .from(t)
          .where(and(eq(t.empresaId, empresaId), ...noPeriodo(t.executadoEm, periodo)))
          .orderBy(desc(t.executadoEm))
          .limit(limite);
        return linhas.map((l) => ({
          id: l.id,
          quando: l.executadoEm,
          status: l.status,
          erro: l.mensagem,
          dados: {
            arquivosProcessados: l.arquivosProcessados,
            ctesProcessados: l.ctesProcessados,
            arquivosComErro: l.arquivosComErro,
            disparadoPor: l.disparadoPor,
          },
        }));
      }
      if (origem === "relatorio_ssw") {
        const t = ingestaoArquivos;
        const linhas = await tx
          .select()
          .from(t)
          .where(and(eq(t.empresaId, empresaId), ...noPeriodo(t.vistoEm, periodo)))
          .orderBy(desc(t.vistoEm))
          .limit(limite);
        return linhas.map((l) => ({
          id: l.id,
          quando: l.importadoEm ?? l.vistoEm,
          status: l.status,
          erro: l.mensagem,
          dados: { relatorio: l.relatorio, nomeArquivo: l.nomeArquivo, linhas: l.linhas },
        }));
      }
      if (origem === "aplicacao_ssw") {
        const t = ingestaoAplicacoes;
        const linhas = await tx
          .select()
          .from(t)
          .where(and(eq(t.empresaId, empresaId), ...noPeriodo(t.iniciadoEm, periodo)))
          .orderBy(desc(t.iniciadoEm))
          .limit(limite);
        return linhas.map((l) => ({
          id: l.id,
          quando: l.iniciadoEm,
          status: l.status,
          erro: l.erro,
          dados: {
            inseridos: l.totalInseridos,
            atualizados: l.totalAtualizados,
            ocorrencias: l.totalOcorrencias,
            ignorados: l.totalIgnorados,
            simulacao: l.simulacao,
          },
        }));
      }
      const t = bi2Sincronizacoes;
      const linhas = await tx
        .select()
        .from(t)
        .where(and(eq(t.empresaId, empresaId), ...noPeriodo(t.iniciadoEm, periodo)))
        .orderBy(desc(t.iniciadoEm))
        .limit(limite);
      return linhas.map((l) => ({
        id: l.id,
        quando: l.iniciadoEm,
        status: l.status,
        erro: l.erro,
        dados: {
          codigo: l.codigoRelatorio,
          dataAlvo: l.dataAlvo,
          modo: l.modo,
          linhas: l.totalLinhas,
          criados: l.criados,
          atualizados: l.atualizados,
        },
      }));
    },
  };
}
