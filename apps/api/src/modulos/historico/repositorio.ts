import { type Transacao } from "@erp/db";
import { anotacoes, empresaUsuarios, feriados, unidades, usuarios } from "@erp/db/schema";
import { and, asc, between, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { type RepositorioHistorico } from "./casos-de-uso";

export function criarRepositorioHistorico(tx: Transacao): RepositorioHistorico {
  return {
    anotacoes: async (empresaId, filtro, limite) => {
      const linhas = await tx
        .select({
          id: anotacoes.id,
          data: anotacoes.data,
          tipo: anotacoes.tipo,
          texto: anotacoes.texto,
          autorId: anotacoes.autorId,
          autorNome: usuarios.nome,
          unidadeId: anotacoes.unidadeId,
          unidadeNome: unidades.nome,
          criadoEm: anotacoes.criadoEm,
        })
        .from(anotacoes)
        .leftJoin(usuarios, eq(usuarios.id, anotacoes.autorId))
        .leftJoin(unidades, eq(unidades.id, anotacoes.unidadeId))
        .where(
          and(
            eq(anotacoes.empresaId, empresaId),
            between(anotacoes.data, filtro.inicio, filtro.fim),
            filtro.unidades.length > 0 ? inArray(anotacoes.unidadeId, filtro.unidades) : undefined,
          ),
        )
        .orderBy(desc(anotacoes.data), desc(anotacoes.criadoEm))
        .limit(limite);
      return linhas.map((l) => ({ ...l, criadoEm: l.criadoEm.toISOString() }));
    },

    feriados: (empresaId, filtro, limite) =>
      tx
        .select({
          id: feriados.id,
          empresaId: feriados.empresaId,
          data: feriados.data,
          tipo: feriados.tipo,
          cidade: feriados.cidade,
          uf: feriados.uf,
          descricao: feriados.descricao,
          geradoAutomaticamente: feriados.geradoAutomaticamente,
        })
        .from(feriados)
        .where(
          and(
            or(isNull(feriados.empresaId), eq(feriados.empresaId, empresaId)),
            between(feriados.data, filtro.de, filtro.ate),
            filtro.tipo ? eq(feriados.tipo, filtro.tipo) : undefined,
            filtro.uf ? eq(feriados.uf, filtro.uf) : undefined,
          ),
        )
        .orderBy(desc(feriados.data))
        .limit(limite),

    unidadesAtivas: (empresaId) =>
      tx
        .select({ id: unidades.id, nome: unidades.nome })
        .from(unidades)
        .where(and(eq(unidades.empresaId, empresaId), eq(unidades.ativo, true)))
        .orderBy(asc(unidades.nome)),

    unidadeDaEmpresa: async (empresaId, unidadeId) => {
      const [linha] = await tx
        .select({ id: unidades.id })
        .from(unidades)
        .where(and(eq(unidades.empresaId, empresaId), eq(unidades.id, unidadeId)));
      return linha !== undefined;
    },

    autores: async (empresaId) => {
      const linhas = await tx
        .select({ id: usuarios.id, nome: usuarios.nome })
        .from(empresaUsuarios)
        .innerJoin(usuarios, eq(usuarios.id, empresaUsuarios.usuarioId))
        .where(and(eq(empresaUsuarios.empresaId, empresaId), isNotNull(usuarios.nome)))
        .orderBy(asc(usuarios.nome));
      return linhas.flatMap((l) => (l.nome === null ? [] : [{ id: l.id, nome: l.nome }]));
    },

    anotacao: async (empresaId, id) => {
      const [linha] = await tx
        .select({
          id: anotacoes.id,
          data: anotacoes.data,
          tipo: anotacoes.tipo,
          texto: anotacoes.texto,
          autorId: anotacoes.autorId,
          unidadeId: anotacoes.unidadeId,
        })
        .from(anotacoes)
        .where(and(eq(anotacoes.empresaId, empresaId), eq(anotacoes.id, id)));
      return linha ?? null;
    },

    criarAnotacao: async (nova) => {
      const [linha] = await tx.insert(anotacoes).values(nova).returning({ id: anotacoes.id });
      if (!linha) throw new Error("insert de anotação não devolveu o id");
      return linha.id;
    },

    alterarAnotacao: async (id, dados, agora) => {
      await tx
        .update(anotacoes)
        .set({ ...dados, atualizadoEm: agora })
        .where(eq(anotacoes.id, id));
    },

    excluirAnotacao: async (id) => {
      await tx.delete(anotacoes).where(eq(anotacoes.id, id));
    },
  };
}
