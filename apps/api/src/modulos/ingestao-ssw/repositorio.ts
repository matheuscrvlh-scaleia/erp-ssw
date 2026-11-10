import { type Transacao } from "@erp/db";
import {
  bi2Sincronizacoes,
  ctes,
  empresaIntegracoes,
  empresas,
  ingestaoCiclos,
  sswWebhookEventos,
  xmlCteOrfaos,
} from "@erp/db/schema";
import { type ContagemWebhook } from "@erp/shared/contratos/ingestao-ssw";
import { and, count, desc, eq, gte, inArray, isNotNull, max, sql } from "drizzle-orm";

import { type EventoLido, type RepositorioIngestaoSsw } from "./casos-de-uso";

const COLUNAS_DO_EVENTO = {
  id: sswWebhookEventos.id,
  recebidoEm: sswWebhookEventos.recebidoEm,
  statusHttp: sswWebhookEventos.statusHttp,
  autenticado: sswWebhookEventos.autenticado,
  motivoRejeicao: sswWebhookEventos.motivoRejeicao,
  erroProcessamento: sswWebhookEventos.erroProcessamento,
  cteId: sswWebhookEventos.cteId,
  numeroCte: ctes.numero,
  temPayload: sql<boolean>`${sswWebhookEventos.payloadBruto} is not null`,
  tokenSha256: sswWebhookEventos.tokenSha256,
};

/** Mesma classificação da tela: rejeitado (auth/4xx), erro (5xx), sem vínculo (202), processado. */
const ehRejeitado = sql`(not ${sswWebhookEventos.autenticado} or ${sswWebhookEventos.statusHttp} between 400 and 499)`;

/** Número que o SSW mandou (para evento sem CT-e). */
const numeroDoPayload = sql<string | null>`coalesce(
  nullif(${sswWebhookEventos.payloadBruto}->'cte'->>'numeroCTe', ''),
  nullif(nullif(${sswWebhookEventos.payloadBruto}->'cte'->>'numeroSSW', ''), '0'),
  ${sswWebhookEventos.payloadBruto}->'nf'->>'numeroNFe')`;

function segredoDaLinha(cifrado: string | null, versao: number | null) {
  return cifrado === null || versao === null ? null : { cifrado, versaoChave: versao };
}

/** Leituras no contexto da sessão (RLS = empresa ativa); escrita com a empresa explícita. */
export function criarRepositorioIngestaoSsw(tx: Transacao): RepositorioIngestaoSsw {
  const eventos = () =>
    tx
      .select(COLUNAS_DO_EVENTO)
      .from(sswWebhookEventos)
      .leftJoin(ctes, eq(ctes.id, sswWebhookEventos.cteId));

  return {
    integracao: async (empresaId, tipo) => {
      const [linha] = await tx
        .select({
          ativo: empresaIntegracoes.ativo,
          parametros: empresaIntegracoes.parametros,
          segredoCifrado: empresaIntegracoes.segredoCifrado,
          segredoVersaoChave: empresaIntegracoes.segredoVersaoChave,
          segredoAnteriorCifrado: empresaIntegracoes.segredoAnteriorCifrado,
          segredoAnteriorVersaoChave: empresaIntegracoes.segredoAnteriorVersaoChave,
          ultimoTesteEm: empresaIntegracoes.ultimoTesteEm,
          ultimoTesteOk: empresaIntegracoes.ultimoTesteOk,
          ultimoTesteMsg: empresaIntegracoes.ultimoTesteMsg,
          atualizadoEm: empresaIntegracoes.atualizadoEm,
        })
        .from(empresaIntegracoes)
        .where(and(eq(empresaIntegracoes.empresaId, empresaId), eq(empresaIntegracoes.tipo, tipo)));
      if (!linha) return null;
      const {
        segredoCifrado,
        segredoVersaoChave,
        segredoAnteriorCifrado,
        segredoAnteriorVersaoChave,
        ...resto
      } = linha;
      const segredo = segredoDaLinha(segredoCifrado, segredoVersaoChave);
      return {
        ...resto,
        segredo,
        segredoAnterior: segredoDaLinha(segredoAnteriorCifrado, segredoAnteriorVersaoChave),
        temSegredo: segredo !== null,
      };
    },

    salvarIntegracao: async (empresaId, tipo, { parametros, segredo }, usuarioId, agora) => {
      const doSegredo = segredo
        ? {
            segredoCifrado: segredo.cifrado,
            segredoVersaoChave: segredo.versaoChave,
            segredoDefinidoEm: agora,
          }
        : {};
      await tx
        .insert(empresaIntegracoes)
        .values({ empresaId, tipo, parametros, ...doSegredo, atualizadoPor: usuarioId })
        .onConflictDoUpdate({
          target: [empresaIntegracoes.empresaId, empresaIntegracoes.tipo],
          set: { parametros, ...doSegredo, atualizadoEm: agora, atualizadoPor: usuarioId },
        });
    },

    sincronizacoesBi2: (relatorio, limite) =>
      tx
        .select({
          relatorio: bi2Sincronizacoes.codigoRelatorio,
          dataAlvo: bi2Sincronizacoes.dataAlvo,
          dataFechamentoSsw: bi2Sincronizacoes.dataFechamentoSsw,
          modo: bi2Sincronizacoes.modo,
          status: bi2Sincronizacoes.status,
          totalLinhas: bi2Sincronizacoes.totalLinhas,
          criados: bi2Sincronizacoes.criados,
          atualizados: bi2Sincronizacoes.atualizados,
          erro: bi2Sincronizacoes.erro,
          iniciadoEm: bi2Sincronizacoes.iniciadoEm,
          finalizadoEm: bi2Sincronizacoes.finalizadoEm,
        })
        .from(bi2Sincronizacoes)
        .where(relatorio === null ? undefined : eq(bi2Sincronizacoes.codigoRelatorio, relatorio))
        .orderBy(desc(bi2Sincronizacoes.iniciadoEm))
        .limit(limite),

    eventosWebhook: (limite) => eventos().orderBy(desc(sswWebhookEventos.recebidoEm)).limit(limite),

    evento: async (id) => (await eventos().where(eq(sswWebhookEventos.id, id)))[0] ?? null,

    eventosComMotivo: (motivo, limite) =>
      tx
        .select({ id: sswWebhookEventos.id, tokenSha256: sswWebhookEventos.tokenSha256 })
        .from(sswWebhookEventos)
        .where(
          and(
            eq(sswWebhookEventos.motivoRejeicao, motivo),
            isNotNull(sswWebhookEventos.payloadBruto),
          ),
        )
        .orderBy(desc(sswWebhookEventos.recebidoEm))
        .limit(limite),

    contagemWebhook: async (desde) => {
      const [linha] = await tx
        .select({
          total: count(),
          rejeitados: sql<number>`(count(*) filter (where ${ehRejeitado}))::int`,
          erros: sql<number>`(count(*) filter (where not ${ehRejeitado} and ${sswWebhookEventos.statusHttp} >= 500))::int`,
          semVinculo: sql<number>`(count(*) filter (where not ${ehRejeitado} and ${sswWebhookEventos.statusHttp} = 202))::int`,
        })
        .from(sswWebhookEventos)
        .where(gte(sswWebhookEventos.recebidoEm, desde));
      const total = linha?.total ?? 0;
      const c: Omit<ContagemWebhook, "processados"> = {
        total,
        rejeitados: linha?.rejeitados ?? 0,
        erros: linha?.erros ?? 0,
        semVinculo: linha?.semVinculo ?? 0,
      };
      return { ...c, processados: total - c.rejeitados - c.erros - c.semVinculo };
    },

    // "Última atividade do webhook" (era sync_state.ultima_hot — Q45 do dono).
    ultimaAtividadeWebhook: async () => {
      const [linha] = await tx
        .select({ em: max(sswWebhookEventos.recebidoEm) })
        .from(sswWebhookEventos)
        .where(and(eq(sswWebhookEventos.autenticado, true), eq(sswWebhookEventos.statusHttp, 200)));
      return linha?.em ?? null;
    },

    semVinculo: async (desde, limite) => {
      const filtro = and(
        gte(sswWebhookEventos.recebidoEm, desde),
        eq(sswWebhookEventos.autenticado, true),
        eq(sswWebhookEventos.statusHttp, 202),
      );
      const [total] = await tx.select({ n: count() }).from(sswWebhookEventos).where(filtro);
      const recentes: EventoLido[] = await tx
        .select({ ...COLUNAS_DO_EVENTO, numeroCte: numeroDoPayload })
        .from(sswWebhookEventos)
        .leftJoin(ctes, eq(ctes.id, sswWebhookEventos.cteId))
        .where(filtro)
        .orderBy(desc(sswWebhookEventos.recebidoEm))
        .limit(limite);
      return { total: total?.n ?? 0, recentes };
    },

    xmlOrfaos: async () => {
      const [linha] = await tx
        .select({
          pendentes: sql<number>`(count(*) filter (where ${xmlCteOrfaos.status} = 'pendente'))::int`,
          expirados: sql<number>`(count(*) filter (where ${xmlCteOrfaos.status} = 'expirado'))::int`,
        })
        .from(xmlCteOrfaos)
        .where(inArray(xmlCteOrfaos.status, ["pendente", "expirado"]));
      return { pendentes: linha?.pendentes ?? 0, expirados: linha?.expirados ?? 0 };
    },

    ultimaAplicacao: async () => {
      const [linha] = await tx
        .select({ em: ingestaoCiclos.aplicadoEm })
        .from(ingestaoCiclos)
        .where(and(eq(ingestaoCiclos.status, "aplicado"), isNotNull(ingestaoCiclos.aplicadoEm)))
        .orderBy(desc(ingestaoCiclos.aplicadoEm))
        .limit(1);
      return linha?.em ?? null;
    },

    marcarReprocesso: async (id) => {
      await tx
        .update(sswWebhookEventos)
        .set({ autenticado: true, erroProcessamento: "reenviado para processamento" })
        .where(eq(sswWebhookEventos.id, id));
    },

    empresasComWebhook: async () => {
      const linhas = await tx
        .select({
          id: empresas.id,
          slug: empresas.slug,
          nome: empresas.nome,
          status: empresas.status,
          integracaoAtiva: empresaIntegracoes.ativo,
          parametros: empresaIntegracoes.parametros,
          segredoCifrado: empresaIntegracoes.segredoCifrado,
          segredoVersaoChave: empresaIntegracoes.segredoVersaoChave,
        })
        .from(empresas)
        .innerJoin(
          empresaIntegracoes,
          and(
            eq(empresaIntegracoes.empresaId, empresas.id),
            eq(empresaIntegracoes.tipo, "ssw_webhook"),
          ),
        )
        .orderBy(empresas.criadoEm, empresas.id);
      return linhas.map(({ segredoCifrado, segredoVersaoChave, ...e }) => ({
        ...e,
        segredo: segredoDaLinha(segredoCifrado, segredoVersaoChave),
      }));
    },

    registrarEvento: async (e) => {
      const [linha] = await tx
        .insert(sswWebhookEventos)
        .values({ ...e, payloadBruto: e.payloadBruto ?? null })
        .returning({ id: sswWebhookEventos.id });
      if (!linha) throw new Error("Gravação do evento do webhook não devolveu a linha.");
      return linha.id;
    },

    quarentenaDesde: async (desde) => {
      const [linha] = await tx
        .select({ n: count() })
        .from(sswWebhookEventos)
        .where(
          and(
            eq(sswWebhookEventos.autenticado, false),
            isNotNull(sswWebhookEventos.payloadBruto),
            gte(sswWebhookEventos.recebidoEm, desde),
          ),
        );
      return linha?.n ?? 0;
    },

    marcarEvento: async (eventoId, statusHttp, erro) => {
      await tx
        .update(sswWebhookEventos)
        .set({ statusHttp, erroProcessamento: erro.slice(0, 2000) })
        .where(eq(sswWebhookEventos.id, eventoId));
    },
  };
}
