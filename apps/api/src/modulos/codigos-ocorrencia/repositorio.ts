import { type Transacao } from "@erp/db";
import { auditoria, codigosOcorrencia, ocorrencias, usuarios } from "@erp/db/schema";
import { and, asc, count, desc, eq, gte, inArray, not, or, sql } from "drizzle-orm";

import { type RepositorioCodigosOcorrencia } from "./casos-de-uso";

const colunasDoCodigo = {
  codigo: codigosOcorrencia.codigo,
  descricao: codigosOcorrencia.descricao,
  responsavel: codigosOcorrencia.responsavel,
  penaliza: codigosOcorrencia.penaliza,
  letraResponsavel: codigosOcorrencia.letraResponsavel,
  ativo: codigosOcorrencia.ativo,
  pendenteClassificacao: codigosOcorrencia.pendenteClassificacao,
  notas: codigosOcorrencia.notas,
  tipoSsw: codigosOcorrencia.tipoSsw,
  processoSsw: codigosOcorrencia.processoSsw,
  atualizadoEm: codigosOcorrencia.atualizadoEm,
  atualizadoPorNome: usuarios.nome,
};

export function criarRepositorioCodigosOcorrencia(tx: Transacao): RepositorioCodigosOcorrencia {
  const selecionar = () =>
    tx
      .select(colunasDoCodigo)
      .from(codigosOcorrencia)
      .leftJoin(usuarios, eq(usuarios.id, codigosOcorrencia.atualizadoPor));

  return {
    listar: (empresaId) =>
      selecionar()
        .where(eq(codigosOcorrencia.empresaId, empresaId))
        .orderBy(asc(codigosOcorrencia.codigo)),

    codigos: (empresaId, codigos) =>
      selecionar().where(
        and(eq(codigosOcorrencia.empresaId, empresaId), inArray(codigosOcorrencia.codigo, codigos)),
      ),

    ocorrenciasPorCodigo: async (empresaId, desde) => {
      const linhas = await tx
        .select({ codigo: ocorrencias.codigo, total: count() })
        .from(ocorrencias)
        .where(
          and(
            eq(ocorrencias.empresaId, empresaId),
            gte(ocorrencias.dataHora, desde),
            not(ocorrencias.quarentena),
          ),
        )
        .groupBy(ocorrencias.codigo);
      return new Map(linhas.map((l) => [l.codigo, l.total]));
    },

    contarOcorrencias: async (empresaId, codigos) => {
      const [linha] = await tx
        .select({ total: count() })
        .from(ocorrencias)
        .where(and(eq(ocorrencias.empresaId, empresaId), inArray(ocorrencias.codigo, codigos)));
      return linha?.total ?? 0;
    },

    gravar: async (empresaId, codigo, dados, usuarioId, agora) => {
      const classificacao = {
        descricao: dados.descricao,
        responsavel: dados.responsavel,
        penaliza: dados.penaliza,
        letraResponsavel: dados.letraResponsavel,
        ativo: dados.ativo,
        pendenteClassificacao: dados.pendenteClassificacao,
        notas: dados.notas,
        atualizadoPor: usuarioId,
        atualizadoEm: agora,
      };
      await tx
        .insert(codigosOcorrencia)
        .values({ empresaId, codigo, ...classificacao })
        .onConflictDoUpdate({
          target: [codigosOcorrencia.empresaId, codigosOcorrencia.codigo],
          set: classificacao,
        });
    },

    // origem: propagate_codigo_changes (sistema atual). Só regrava o que está diferente.
    propagarClassificacao: async (empresaId, codigo) => {
      const resultado = await tx
        .update(ocorrencias)
        .set({
          penaliza: sql`${codigosOcorrencia.penaliza}`,
          responsavel: sql`${codigosOcorrencia.responsavel}`,
        })
        .from(codigosOcorrencia)
        .where(
          and(
            eq(ocorrencias.empresaId, empresaId),
            eq(ocorrencias.codigo, codigo),
            eq(codigosOcorrencia.empresaId, ocorrencias.empresaId),
            eq(codigosOcorrencia.codigo, ocorrencias.codigo),
            or(
              sql`${ocorrencias.penaliza} is distinct from ${codigosOcorrencia.penaliza}`,
              sql`${ocorrencias.responsavel} is distinct from ${codigosOcorrencia.responsavel}`,
            ),
          ),
        );
      return resultado.rowCount ?? 0;
    },

    historico: (empresaId, codigo, limite) =>
      tx
        .select({
          id: sql<string>`${auditoria.id}::text`,
          criadoEm: auditoria.criadoEm,
          acao: auditoria.acao,
          antes: auditoria.antes,
          depois: auditoria.depois,
          autorNome: sql<string | null>`coalesce(${usuarios.nome}, ${auditoria.atorEmail})`,
        })
        .from(auditoria)
        .leftJoin(usuarios, eq(usuarios.id, auditoria.atorId))
        .where(
          and(
            eq(auditoria.empresaId, empresaId),
            eq(auditoria.entidade, "codigo_ocorrencia"),
            eq(auditoria.entidadeId, String(codigo)),
          ),
        )
        .orderBy(desc(auditoria.criadoEm))
        .limit(limite),
  };
}
