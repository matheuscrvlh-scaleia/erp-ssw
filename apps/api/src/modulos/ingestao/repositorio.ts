/**
 * Leituras das telas de ingestão nas tabelas que o worker-ssw grava (ADR 0012), a pausa do FTP e
 * o descarte de ciclo. Toda consulta leva a empresa (além do RLS).
 */
import { type Transacao } from "@erp/db";
import {
  configuracoes,
  ingestaoAplicacoes,
  ingestaoArquivos,
  ingestaoCiclos,
  ingestaoErros,
  ingestaoLinhas,
  ingestaoRelatoriosEsperados,
  xmlCteArquivos,
  xmlCteOrfaos,
  xmlFtpSincronizacoes,
} from "@erp/db/schema";
import { configuracoesVigentes } from "@erp/dominio/configuracoes";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";

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
  const doCiclo = (empresaId: string, cicloChave: string) =>
    and(eq(ingestaoArquivos.empresaId, empresaId), eq(ingestaoArquivos.cicloChave, cicloChave));

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

    async gravarFtpAtivo(empresaId, ativo, usuarioId) {
      const valor = String(ativo);
      await tx
        .insert(configuracoes)
        .values({
          empresaId,
          chave: FTP_ATIVO,
          valor,
          descricao: "",
          grupo: "ingestao",
          atualizadoPor: usuarioId,
        })
        .onConflictDoUpdate({
          target: [configuracoes.empresaId, configuracoes.chave],
          set: { valor, atualizadoEm: sql`now()`, atualizadoPor: usuarioId },
        });
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

    async ciclo(empresaId, cicloChave) {
      const [c] = await tx
        .select()
        .from(ingestaoCiclos)
        .where(
          and(eq(ingestaoCiclos.empresaId, empresaId), eq(ingestaoCiclos.cicloChave, cicloChave)),
        );
      return c ? comoCiclo(c) : null;
    },

    async apagarStagingDoCiclo(empresaId, cicloChave) {
      const lotes = (
        await tx
          .select({ loteId: ingestaoArquivos.loteId })
          .from(ingestaoArquivos)
          .where(and(doCiclo(empresaId, cicloChave), isNotNull(ingestaoArquivos.loteId)))
      ).flatMap((a) => (a.loteId ? [a.loteId] : []));
      if (lotes.length === 0) return { linhas: 0, erros: 0, apagadas: [] };
      const apagadas = await tx
        .delete(ingestaoLinhas)
        .where(and(eq(ingestaoLinhas.empresaId, empresaId), inArray(ingestaoLinhas.loteId, lotes)))
        .returning({
          relatorio: ingestaoLinhas.relatorio,
          sigla: ingestaoLinhas.sigla,
          numero: ingestaoLinhas.numero,
          dados: ingestaoLinhas.dados,
        });
      const erros = await tx
        .delete(ingestaoErros)
        .where(and(eq(ingestaoErros.empresaId, empresaId), inArray(ingestaoErros.loteId, lotes)))
        .returning({ id: ingestaoErros.id });
      return { linhas: apagadas.length, erros: erros.length, apagadas };
    },

    async marcarCicloDescartado(empresaId, cicloChave, motivo) {
      await tx
        .update(ingestaoArquivos)
        .set({
          status: "descartado",
          mensagem: sql`coalesce(${ingestaoArquivos.mensagem}, '') || ' [ciclo descartado]'`,
          atualizadoEm: sql`now()`,
        })
        .where(doCiclo(empresaId, cicloChave));
      await tx
        .update(ingestaoCiclos)
        .set({ status: "descartado", motivo, atualizadoEm: sql`now()` })
        .where(
          and(eq(ingestaoCiclos.empresaId, empresaId), eq(ingestaoCiclos.cicloChave, cicloChave)),
        );
    },
  };
}
