import { type Transacao } from "@erp/db";
import { feriados, unidades } from "@erp/db/schema";
import { chaveDoFeriado } from "@erp/dominio/calendario";
import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";

import { type RepositorioCalendario } from "./casos-de-uso";

// Teto de segurança: um ano tem algumas dezenas de feriados por empresa.
const LIMITE_POR_ANO = 2000;

const colunas = {
  id: feriados.id,
  empresaId: feriados.empresaId,
  data: feriados.data,
  tipo: feriados.tipo,
  cidade: feriados.cidade,
  uf: feriados.uf,
  descricao: feriados.descricao,
  geradoAutomaticamente: feriados.geradoAutomaticamente,
};

/** Nacionais (empresa nula) + os da empresa. O RLS repete esta regra como segunda barreira. */
const visiveisPara = (empresaId: string) =>
  or(isNull(feriados.empresaId), eq(feriados.empresaId, empresaId));

export function criarRepositorioCalendario(tx: Transacao): RepositorioCalendario {
  return {
    feriados: (empresaId, de, ate) =>
      tx
        .select(colunas)
        .from(feriados)
        .where(and(visiveisPara(empresaId), gte(feriados.data, de), lte(feriados.data, ate)))
        .orderBy(asc(feriados.data))
        .limit(LIMITE_POR_ANO),

    proximo: async (empresaId, aPartirDe) => {
      const [linha] = await tx
        .select(colunas)
        .from(feriados)
        .where(and(visiveisPara(empresaId), gte(feriados.data, aPartirDe)))
        .orderBy(asc(feriados.data))
        .limit(1);
      return linha ?? null;
    },

    unidadesAtivas: (empresaId) =>
      tx
        .select({ id: unidades.id, nome: unidades.nome, cidade: unidades.cidade, uf: unidades.uf })
        .from(unidades)
        .where(and(eq(unidades.empresaId, empresaId), eq(unidades.ativo, true)))
        .orderBy(asc(unidades.nome)),

    feriado: async (empresaId, id) => {
      const [linha] = await tx
        .select(colunas)
        .from(feriados)
        .where(and(visiveisPara(empresaId), eq(feriados.id, id)));
      return linha ?? null;
    },

    chavesExistentes: async (empresaId, datas, tipo) => {
      const linhas = await tx
        .select({
          data: feriados.data,
          tipo: feriados.tipo,
          cidade: feriados.cidade,
          uf: feriados.uf,
        })
        .from(feriados)
        .where(
          and(visiveisPara(empresaId), inArray(feriados.data, datas), eq(feriados.tipo, tipo)),
        );
      return new Set(linhas.map(chaveDoFeriado));
    },

    inserir: async (novos) => {
      const inseridos = await tx
        .insert(feriados)
        .values(novos)
        .onConflictDoNothing()
        .returning({ id: feriados.id });
      return inseridos.length;
    },

    alterar: async (id, dados) => {
      await tx.update(feriados).set(dados).where(eq(feriados.id, id));
    },

    excluir: async (id) => {
      await tx.delete(feriados).where(eq(feriados.id, id));
    },
  };
}
