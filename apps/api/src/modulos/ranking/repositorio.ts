import { type Transacao } from "@erp/db";
import {
  bonificacaoRegraCriterios,
  bonificacaoRegras,
  codigosOcorrencia,
  ctes,
  equipeMembros,
  equipes,
  filiais,
  ocorrencias,
  unidades,
} from "@erp/db/schema";
import { decimalEmUnidades, type SituacaoPrevista } from "@erp/dominio/ranking";
import { type Regra } from "@erp/shared/contratos/ranking";
import { and, asc, desc, eq, gte, inArray, isNull, lte, not, type SQL, sql } from "drizzle-orm";

import { type RepositorioRanking } from "./casos-de-uso";
import { condicaoDoFiltro } from "./filtro-performance";

/** Teto da lista de CT-e para atribuir (igual a hoje). */
const LIMITE_PARA_ATRIBUIR = 500;

const colunasDaEquipe = {
  id: equipes.id,
  nome: equipes.nome,
  unidadeId: equipes.unidadeId,
  ativo: equipes.ativo,
  tokenPublicoHash: equipes.tokenPublicoHash,
  tokenPublicoRevogado: equipes.tokenPublicoRevogado,
};

const colunasDoMembro = {
  id: equipeMembros.id,
  equipeId: equipeMembros.equipeId,
  nome: equipeMembros.nome,
  papel: equipeMembros.papel,
  cpf: equipeMembros.cpf,
  posicao: equipeMembros.posicao,
  dataSaida: equipeMembros.dataSaida,
};

function chaveDoGrupo(grupo: "pagador" | "cidade"): SQL<string> {
  return grupo === "cidade"
    ? sql<string>`upper(btrim(coalesce(${ctes.cidadeDestino}, '')))`
    : sql<string>`coalesce(${ctes.pagadorCnpjDigitos}, '')`;
}

export function criarRepositorioRanking(tx: Transacao): RepositorioRanking {
  const regrasCom = async (condicao: SQL | undefined): Promise<Regra[]> => {
    const linhas = await tx
      .select()
      .from(bonificacaoRegras)
      .where(condicao)
      .orderBy(desc(bonificacaoRegras.vigenciaInicio), asc(bonificacaoRegras.nome));
    if (linhas.length === 0) return [];
    const criterios = await tx
      .select()
      .from(bonificacaoRegraCriterios)
      .where(
        inArray(
          bonificacaoRegraCriterios.regraId,
          linhas.map((l) => l.id),
        ),
      )
      .orderBy(asc(bonificacaoRegraCriterios.ordem), asc(bonificacaoRegraCriterios.criadoEm));
    return linhas.map((r) => ({
      id: r.id,
      nome: r.nome,
      descricao: r.descricao,
      vigenciaInicio: r.vigenciaInicio,
      vigenciaFim: r.vigenciaFim,
      ativo: r.ativo,
      criterios: criterios
        .filter((c) => c.regraId === r.id)
        .map((c) => ({
          id: c.id,
          criterio: c.criterio,
          parametros: parametrosGravados(c.parametros),
          ordem: c.ordem,
        })),
    }));
  };

  return {
    filiaisProprias: async (empresaId) =>
      (
        await tx
          .select({ sigla: filiais.sigla })
          .from(filiais)
          .where(and(eq(filiais.empresaId, empresaId), eq(filiais.propria, true)))
      ).map((f) => f.sigla),

    codigosBaixa: async (empresaId) =>
      (
        await tx
          .select({ codigo: codigosOcorrencia.codigo })
          .from(codigosOcorrencia)
          .where(
            and(eq(codigosOcorrencia.empresaId, empresaId), eq(codigosOcorrencia.tipoSsw, "BAIXA")),
          )
      ).map((c) => c.codigo),

    baldes: async (filtro, grupo, hoje) => {
      const chave = chaveDoGrupo(grupo);
      const linhas = await tx
        .select({
          chave,
          temDataEntrega: sql<boolean>`${ctes.dataEntregaRealizada} is not null`,
          codigoEfetivo: ctes.ocorrEfetivaCodigoNum,
          noPrazo: ctes.noPrazo,
          responsabilidadeCliente: ctes.responsabilidadeCliente,
          prevista: sql<SituacaoPrevista>`case
            when ${ctes.dataPrevistaEntrega} is null then 'sem_previsao'
            when ${ctes.dataPrevistaEntrega} < ${hoje} then 'vencida'
            else 'no_prazo' end`,
          quantidade: sql<number>`count(*)::int`,
          peso: sql<string | null>`sum(${ctes.peso})::text`,
          volumes: sql<string | null>`sum(${ctes.volumes})::text`,
          frete: sql<string | null>`sum(${ctes.valorFrete})::text`,
        })
        .from(ctes)
        .where(and(condicaoDoFiltro(filtro), sql`${chave} <> ''`))
        // Por posição: a mesma expressão com parâmetro ($n) no SELECT e no GROUP BY não casa.
        .groupBy(sql`1, 2, 3, 4, 5, 6`);
      return linhas.map((l) => ({
        chave: l.chave,
        temDataEntrega: l.temDataEntrega,
        codigoEfetivo: l.codigoEfetivo,
        noPrazo: l.noPrazo,
        responsabilidadeCliente: l.responsabilidadeCliente,
        prevista: l.prevista,
        quantidade: l.quantidade,
        pesoGramas: decimalEmUnidades(l.peso, 3),
        volumes: decimalEmUnidades(l.volumes, 0),
        freteCentavos: decimalEmUnidades(l.frete, 2),
      }));
    },

    rotulos: (filtro, grupo) => {
      const chave = chaveDoGrupo(grupo);
      const origem = grupo === "cidade" ? ctes.cidadeDestino : ctes.pagadorNome;
      return tx
        .select({
          chave,
          // Mais frequente; empate = menor (ordem do banco). Nulo não conta.
          rotulo: sql<
            string | null
          >`mode() within group (order by ${origem}) filter (where ${origem} is not null)`,
          sub: grupo === "cidade" ? sql<string | null>`max(${ctes.ufDestino})` : sql<null>`null`,
        })
        .from(ctes)
        .where(and(condicaoDoFiltro(filtro), sql`${chave} <> ''`))
        .groupBy(sql`1`);
    },

    equipes: (empresaId) =>
      tx
        .select(colunasDaEquipe)
        .from(equipes)
        .where(eq(equipes.empresaId, empresaId))
        .orderBy(asc(equipes.nome)),

    equipe: async (empresaId, id) => {
      const [linha] = await tx
        .select(colunasDaEquipe)
        .from(equipes)
        .where(and(eq(equipes.empresaId, empresaId), eq(equipes.id, id)));
      return linha ?? null;
    },

    membrosAtivos: (empresaId) =>
      tx
        .select(colunasDoMembro)
        .from(equipeMembros)
        .where(and(eq(equipeMembros.empresaId, empresaId), isNull(equipeMembros.dataSaida))),

    membro: async (empresaId, id) => {
      const [linha] = await tx
        .select(colunasDoMembro)
        .from(equipeMembros)
        .where(and(eq(equipeMembros.empresaId, empresaId), eq(equipeMembros.id, id)));
      return linha ?? null;
    },

    unidades: (empresaId) =>
      tx
        .select({ id: unidades.id, nome: unidades.nome })
        .from(unidades)
        .where(and(eq(unidades.empresaId, empresaId), eq(unidades.ativo, true)))
        .orderBy(asc(unidades.nome)),

    inserirEquipe: async (empresaId, dados) => {
      const [linha] = await tx
        .insert(equipes)
        .values({ empresaId, ...dados })
        .returning({ id: equipes.id });
      if (!linha) throw new Error("insert de equipe sem retorno");
      return linha.id;
    },

    alterarEquipe: async (id, dados) => {
      await tx
        .update(equipes)
        .set({ ...dados, atualizadoEm: new Date() })
        .where(eq(equipes.id, id));
    },

    inserirMembro: async (empresaId, dados) => {
      await tx.insert(equipeMembros).values({ empresaId, ...dados });
    },

    encerrarMembro: async (id, dataSaida) => {
      await tx.update(equipeMembros).set({ dataSaida }).where(eq(equipeMembros.id, id));
    },

    gravarLink: async (equipeId, link) => {
      await tx
        .update(equipes)
        .set({
          tokenPublicoHash: link.hash,
          tokenPublicoRevogado: link.revogado,
          atualizadoEm: new Date(),
        })
        .where(eq(equipes.id, equipeId));
    },

    ctesParaAtribuir: (empresaId, filtro) =>
      tx
        .select({
          id: ctes.id,
          sigla: ctes.sigla,
          numero: ctes.numero,
          dataEmissao: ctes.dataEmissao,
          cidadeDestino: ctes.cidadeDestino,
          ufDestino: ctes.ufDestino,
          motoristaNome: ctes.motoristaNome,
        })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            not(ctes.foraUniverso),
            gte(ctes.dataEmissao, filtro.inicio),
            lte(ctes.dataEmissao, filtro.fim),
            filtro.somenteSemEquipe ? isNull(ctes.equipeId) : undefined,
            filtro.unidadeId ? eq(ctes.unidadeId, filtro.unidadeId) : undefined,
          ),
        )
        .orderBy(desc(ctes.dataEmissao))
        .limit(LIMITE_PARA_ATRIBUIR),

    atribuirEquipe: async (empresaId, cteIds, equipeId) => {
      const alterados = await tx
        .update(ctes)
        .set({ equipeId, atualizadoEm: new Date() })
        .where(and(eq(ctes.empresaId, empresaId), inArray(ctes.id, cteIds)))
        .returning({ id: ctes.id });
      return alterados.length;
    },

    regras: (empresaId) => regrasCom(eq(bonificacaoRegras.empresaId, empresaId)),

    regra: async (empresaId, id) => {
      const [regra] = await regrasCom(
        and(eq(bonificacaoRegras.empresaId, empresaId), eq(bonificacaoRegras.id, id)),
      );
      return regra ?? null;
    },

    inserirRegra: async (empresaId, dados) => {
      const [linha] = await tx
        .insert(bonificacaoRegras)
        .values({ empresaId, ...dados })
        .returning({ id: bonificacaoRegras.id });
      if (!linha) throw new Error("insert de regra sem retorno");
      return linha.id;
    },

    alterarRegra: async (id, dados) => {
      await tx
        .update(bonificacaoRegras)
        .set({ ...dados, atualizadoEm: new Date() })
        .where(eq(bonificacaoRegras.id, id));
    },

    substituirCriterios: async (empresaId, regraId, criterios) => {
      await tx
        .delete(bonificacaoRegraCriterios)
        .where(eq(bonificacaoRegraCriterios.regraId, regraId));
      if (criterios.length === 0) return;
      await tx.insert(bonificacaoRegraCriterios).values(
        criterios.map((c, ordem) => ({
          empresaId,
          regraId,
          criterio: c.criterio,
          parametros: c.parametros,
          ordem,
        })),
      );
    },

    excluirRegra: async (id) => {
      await tx.delete(bonificacaoRegras).where(eq(bonificacaoRegras.id, id));
    },

    totaisPorEquipe: async (empresaId, equipeIds, periodo) => {
      if (equipeIds.length === 0) return new Map();
      const doPeriodo = and(
        eq(ctes.empresaId, empresaId),
        inArray(ctes.equipeId, equipeIds),
        gte(ctes.dataEmissao, periodo.inicio),
        lte(ctes.dataEmissao, periodo.fim),
      );
      // Entrega no prazo: dia da entrega no fuso da empresa (Q11) até o prazo.
      const totais = await tx
        .select({
          equipeId: sql<string>`${ctes.equipeId}`,
          totalEntregas: sql<number>`count(*)::int`,
          entregasNoPrazo: sql<number>`(count(*) filter (where ${ctes.dataEntregaRealizada} is not null
            and ${ctes.prazoEntrega} is not null
            and (${ctes.dataEntregaRealizada} at time zone ${periodo.fuso})::date <= ${ctes.prazoEntrega}))::int`,
        })
        .from(ctes)
        .where(doPeriodo)
        .groupBy(ctes.equipeId);
      // Ocorrências penalizantes dos CT-e da equipe; em quarentena não contam (Q21).
      const penalizantes = await tx
        .select({
          equipeId: sql<string>`${ctes.equipeId}`,
          quantidade: sql<number>`count(*)::int`,
        })
        .from(ocorrencias)
        .innerJoin(ctes, eq(ctes.id, ocorrencias.cteId))
        .where(and(doPeriodo, eq(ocorrencias.penaliza, true), not(ocorrencias.quarentena)))
        .groupBy(ctes.equipeId);
      return new Map(
        totais.map((t) => [
          t.equipeId,
          {
            totalEntregas: t.totalEntregas,
            entregasNoPrazo: t.entregasNoPrazo,
            penalizantes: penalizantes.find((p) => p.equipeId === t.equipeId)?.quantidade ?? 0,
          },
        ]),
      );
    },

    equipePorToken: async (hash) => {
      const [linha] = await tx
        .select({ id: equipes.id, empresaId: equipes.empresaId })
        .from(equipes)
        .where(and(eq(equipes.tokenPublicoHash, hash), not(equipes.tokenPublicoRevogado)));
      return linha ?? null;
    },
  };
}

/** Parâmetros gravados (jsonb): só número e texto passam para o cálculo. */
function parametrosGravados(valor: unknown): Record<string, string | number> {
  if (typeof valor !== "object" || valor === null) return {};
  return Object.fromEntries(
    Object.entries(valor).filter(
      (par): par is [string, string | number] =>
        typeof par[1] === "string" || typeof par[1] === "number",
    ),
  );
}
