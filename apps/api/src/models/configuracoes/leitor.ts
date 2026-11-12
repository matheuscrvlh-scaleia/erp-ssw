import { type Transacao } from "@erp/db";
import { configuracoes } from "@erp/db/schema";
import { type ConfiguracaoLida, configuracoesVigentes } from "@erp/dominio/configuracoes";
import { eq, isNull, or } from "drizzle-orm";

import { type CacheDeConfiguracoes } from "./cache";

/** Valores vigentes (empresa vence Plataforma) das chaves pedidas que existem. */
export type LeitorDeConfiguracoes = (
  empresaId: string | null,
  chaves: readonly string[],
) => Promise<Map<string, string>>;

/** Linhas da empresa e da Plataforma; sem empresa, só as da Plataforma. */
export type CarregarConfiguracoes = (empresaId: string | null) => Promise<ConfiguracaoLida[]>;

export function carregarConfiguracoesDoBanco(tx: Transacao): CarregarConfiguracoes {
  return (empresaId) =>
    tx
      .select({
        empresaId: configuracoes.empresaId,
        chave: configuracoes.chave,
        valor: configuracoes.valor,
      })
      .from(configuracoes)
      .where(
        empresaId === null
          ? isNull(configuracoes.empresaId)
          : or(eq(configuracoes.empresaId, empresaId), isNull(configuracoes.empresaId)),
      );
}

/**
 * Leitura de configuração das telas: todas as chaves da empresa com o padrão da Plataforma por
 * baixo, guardadas no cache da empresa. Sem empresa (contexto da Plataforma), só os padrões, sem
 * cache.
 */
export function criarLeitorDeConfiguracoes(
  carregar: CarregarConfiguracoes,
  cache: CacheDeConfiguracoes,
): LeitorDeConfiguracoes {
  return async (empresaId, chaves) => {
    const vigentes = async () => configuracoesVigentes(await carregar(empresaId));
    const todas = empresaId === null ? await vigentes() : await cache.valores(empresaId, vigentes);
    return new Map(chaves.flatMap((c) => (todas.has(c) ? [[c, todas.get(c) ?? ""]] : [])));
  };
}
