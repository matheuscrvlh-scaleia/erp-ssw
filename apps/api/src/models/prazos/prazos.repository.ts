import { type Transacao } from "@erp/db";
import { ctes, prazosConfigurados } from "@erp/db/schema";
import { and, asc, eq, isNotNull, max, ne, sql } from "drizzle-orm";

import { type RegraGravada, type RepositorioPrazos } from "./prazos.service";

const colunas = {
  id: prazosConfigurados.id,
  tipo: prazosConfigurados.tipo,
  unidadeCodigo: prazosConfigurados.unidadeCodigo,
  unidadeDestinoCodigo: prazosConfigurados.unidadeDestinoCodigo,
  parceiroCnpj: prazosConfigurados.parceiroCnpj,
  parceiroNome: prazosConfigurados.parceiroNome,
  prazoHoras: prazosConfigurados.prazoHoras,
  prazoDias: prazosConfigurados.prazoDias,
  ativo: prazosConfigurados.ativo,
  criadoEm: prazosConfigurados.criadoEm,
  atualizadoEm: prazosConfigurados.atualizadoEm,
};

const daEmpresa = (empresaId: string, id: string) =>
  and(eq(prazosConfigurados.empresaId, empresaId), eq(prazosConfigurados.id, id));

export function criarRepositorioPrazos(tx: Transacao): RepositorioPrazos {
  return {
    regras: (empresaId): Promise<RegraGravada[]> =>
      tx
        .select(colunas)
        .from(prazosConfigurados)
        .where(eq(prazosConfigurados.empresaId, empresaId)),

    regra: async (empresaId, id) => {
      const [linha] = await tx
        .select(colunas)
        .from(prazosConfigurados)
        .where(daEmpresa(empresaId, id));
      return linha ?? null;
    },

    criar: async (empresaId, dados) => {
      const [linha] = await tx
        .insert(prazosConfigurados)
        .values({ empresaId, ...dados })
        .returning({ id: prazosConfigurados.id });
      if (!linha) throw new Error("insert de prazo sem retorno");
      return linha.id;
    },

    alterar: async (empresaId, id, dados) => {
      await tx
        .update(prazosConfigurados)
        .set({ ...dados, atualizadoEm: new Date() })
        .where(daEmpresa(empresaId, id));
    },

    ligar: async (empresaId, id, ativo) => {
      await tx
        .update(prazosConfigurados)
        .set({ ativo, atualizadoEm: new Date() })
        .where(daEmpresa(empresaId, id));
    },

    excluir: async (empresaId, id) => {
      await tx.delete(prazosConfigurados).where(daEmpresa(empresaId, id));
    },

    unidadesDosCtes: async (empresaId) => {
      const cidade = max(sql<string>`nullif(btrim(${ctes.unidadeCidade}), '')`);
      const linhas = await tx
        .select({ codigo: ctes.filial, cidade })
        .from(ctes)
        .where(and(eq(ctes.empresaId, empresaId), isNotNull(ctes.filial), ne(ctes.filial, "")))
        .groupBy(ctes.filial)
        .orderBy(asc(ctes.filial));
      return linhas.flatMap((l) =>
        l.codigo && l.cidade ? [{ codigo: l.codigo, cidade: l.cidade }] : [],
      );
    },

    parceirosDosCtes: async (empresaId) => {
      const nome = max(sql<string>`nullif(btrim(${ctes.parceiroNome}), '')`);
      const linhas = await tx
        .select({ cnpj: ctes.parceiroCnpj, nome })
        .from(ctes)
        .where(
          and(
            eq(ctes.empresaId, empresaId),
            isNotNull(ctes.parceiroCnpj),
            ne(ctes.parceiroCnpj, ""),
          ),
        )
        .groupBy(ctes.parceiroCnpj);
      return linhas
        .flatMap((l) => (l.cnpj && l.nome ? [{ cnpj: l.cnpj, nome: l.nome }] : []))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    },
  };
}
