/**
 * Leituras das telas de ingestão nas tabelas que o worker-ssw grava (ADR 0012). Toda consulta leva
 * a empresa (além do RLS).
 */
import { type Transacao } from "@erp/db";
import {
  configuracoes,
  ingestaoAplicacoes,
  ingestaoArquivos,
  ingestaoCiclos,
  ingestaoRelatoriosEsperados,
  xmlCteArquivos,
  xmlCteOrfaos,
  xmlFtpSincronizacoes,
} from "@erp/db/schema";
import { configuracoesVigentes } from "@erp/dominio/configuracoes";
import { and, desc, eq, sql } from "drizzle-orm";

import { type ArquivoLido, type CicloLido, type RepositorioIngestao } from "./casos-de-uso";

const FTP_ATIVO = "ftp_sync_ativo";

function comoCiclo(c: typeof ingestaoCiclos.$inferSelect): CicloLido {
  return {
    cicloChave: c.cicloChave,
    status: c.status,
    motivo: c.motivo,
    faltantes: Array.isArray(c.faltantes) ? c.faltantes.map(String) : [],
    totais:
      typeof c.totais === "object" && c.totais !== null && !Array.isArray(c.totais)
        ? (c.totais as Record<string, unknown>)
        : {},
    arquivosImportados: c.arquivosImportados,
    linhasImportadas: c.linhasImportadas,
    primeiroArquivoEm: c.primeiroArquivoEm,
    ultimoArquivoEm: c.ultimoArquivoEm,
    fechadoEm: c.fechadoEm,
    aplicadoEm: c.aplicadoEm,
  };
}

const COLUNAS_DO_ARQUIVO = {
  nomeArquivo: ingestaoArquivos.nomeArquivo,
  cicloChave: ingestaoArquivos.cicloChave,
  relatorio: ingestaoArquivos.relatorio,
  unidade: ingestaoArquivos.unidade,
  status: ingestaoArquivos.status,
  linhas: ingestaoArquivos.linhas,
  mensagem: ingestaoArquivos.mensagem,
  vistoEm: ingestaoArquivos.vistoEm,
  importadoEm: ingestaoArquivos.importadoEm,
};

export function criarRepositorioIngestao(tx: Transacao): RepositorioIngestao {
  return {
    async ultimosCiclos(empresaId, limite) {
      const linhas = await tx
        .select()
        .from(ingestaoCiclos)
        .where(eq(ingestaoCiclos.empresaId, empresaId))
        .orderBy(desc(ingestaoCiclos.cicloChave))
        .limit(limite);
      return linhas.map(comoCiclo);
    },

    ultimosArquivos: (empresaId, limite): Promise<ArquivoLido[]> =>
      tx
        .select(COLUNAS_DO_ARQUIVO)
        .from(ingestaoArquivos)
        .where(eq(ingestaoArquivos.empresaId, empresaId))
        .orderBy(desc(ingestaoArquivos.vistoEm))
        .limit(limite),

    relatoriosEsperados: (empresaId) =>
      tx
        .select({
          relatorio: ingestaoRelatoriosEsperados.relatorio,
          porUnidade: ingestaoRelatoriosEsperados.porUnidade,
          unidadesEsperadas: ingestaoRelatoriosEsperados.unidadesEsperadas,
          obrigatorioNoCiclo: ingestaoRelatoriosEsperados.obrigatorioNoCiclo,
          ativo: ingestaoRelatoriosEsperados.ativo,
        })
        .from(ingestaoRelatoriosEsperados)
        .where(eq(ingestaoRelatoriosEsperados.empresaId, empresaId)),

    ultimasAplicacoes: (empresaId, limite) =>
      tx
        .select({
          id: ingestaoAplicacoes.id,
          status: ingestaoAplicacoes.status,
          simulacao: ingestaoAplicacoes.simulacao,
          totalInseridos: ingestaoAplicacoes.totalInseridos,
          totalAtualizados: ingestaoAplicacoes.totalAtualizados,
          totalOcorrencias: ingestaoAplicacoes.totalOcorrencias,
          totalIgnorados: ingestaoAplicacoes.totalIgnorados,
          erro: ingestaoAplicacoes.erro,
          iniciadoEm: ingestaoAplicacoes.iniciadoEm,
          finalizadoEm: ingestaoAplicacoes.finalizadoEm,
        })
        .from(ingestaoAplicacoes)
        .where(eq(ingestaoAplicacoes.empresaId, empresaId))
        .orderBy(desc(ingestaoAplicacoes.iniciadoEm))
        .limit(limite),

    async ftpAtivo(empresaId) {
      const linhas = await tx
        .select({
          empresaId: configuracoes.empresaId,
          chave: configuracoes.chave,
          valor: configuracoes.valor,
        })
        .from(configuracoes)
        .where(
          and(
            eq(configuracoes.chave, FTP_ATIVO),
            sql`(${configuracoes.empresaId} = ${empresaId} or ${configuracoes.empresaId} is null)`,
          ),
        );
      return configuracoesVigentes(linhas).get(FTP_ATIVO) !== "false";
    },

    async ultimasSincronizacoes(empresaId, limite) {
      const linhas = await tx
        .select({
          executadoEm: xmlFtpSincronizacoes.executadoEm,
          finalizadoEm: xmlFtpSincronizacoes.finalizadoEm,
          status: xmlFtpSincronizacoes.status,
          disparadoPor: xmlFtpSincronizacoes.disparadoPor,
          arquivosProcessados: xmlFtpSincronizacoes.arquivosProcessados,
          arquivosMovidos: xmlFtpSincronizacoes.arquivosMovidos,
          pastasLimpas: xmlFtpSincronizacoes.pastasLimpas,
          arquivosComErro: xmlFtpSincronizacoes.arquivosComErro,
          duracaoMs: xmlFtpSincronizacoes.duracaoMs,
          mensagem: xmlFtpSincronizacoes.mensagem,
          erros: xmlFtpSincronizacoes.erros,
        })
        .from(xmlFtpSincronizacoes)
        .where(eq(xmlFtpSincronizacoes.empresaId, empresaId))
        .orderBy(desc(xmlFtpSincronizacoes.executadoEm))
        .limit(limite);
      return linhas.map((l) => ({
        ...l,
        erros: Array.isArray(l.erros) ? l.erros.map(String) : [],
      }));
    },

    ultimosArquivosXml: (empresaId, limite) =>
      tx
        .select({
          id: xmlCteArquivos.id,
          nomeArquivo: xmlCteArquivos.nomeArquivo,
          tipo: xmlCteArquivos.tipo,
          status: xmlCteArquivos.status,
          erroMensagem: xmlCteArquivos.erroMensagem,
          ctesProcessados: xmlCteArquivos.ctesProcessados,
          cancelamentos: xmlCteArquivos.cancelamentos,
          xmlsPulados: xmlCteArquivos.xmlsPulados,
          criadoEm: xmlCteArquivos.criadoEm,
        })
        .from(xmlCteArquivos)
        .where(eq(xmlCteArquivos.empresaId, empresaId))
        .orderBy(desc(xmlCteArquivos.criadoEm))
        .limit(limite),

    async estatisticasDosOrfaos(empresaId) {
      const [r] = await tx
        .select({
          pendentes: sql<number>`count(*) filter (where ${xmlCteOrfaos.status} = 'pendente')::int`,
          expirados: sql<number>`count(*) filter (where ${xmlCteOrfaos.status} = 'expirado')::int`,
          casados: sql<number>`count(*) filter (where ${xmlCteOrfaos.status} = 'casado')::int`,
          maisAntigo: sql<Date | null>`min(${xmlCteOrfaos.criadoEm}) filter (where ${xmlCteOrfaos.status} = 'pendente')`,
        })
        .from(xmlCteOrfaos)
        .where(eq(xmlCteOrfaos.empresaId, empresaId));
      return {
        pendentes: r?.pendentes ?? 0,
        expirados: r?.expirados ?? 0,
        casados: r?.casados ?? 0,
        maisAntigo: r?.maisAntigo ? new Date(r.maisAntigo) : null,
      };
    },
  };
}
