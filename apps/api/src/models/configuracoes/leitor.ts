import { sql, type Transacao } from "@erp/db";
import { type ConfiguracaoLida, configuracoesVigentes } from "@erp/dominio/configuracoes";

import { type CacheDeConfiguracoes } from "./cache";

/** Valores vigentes (empresa vence Plataforma) das chaves pedidas que existem. */
export type LeitorDeConfiguracoes = (
  empresaId: string | null,
  chaves: readonly string[],
) => Promise<Map<string, string>>;

/** Linhas da empresa e da Plataforma; sem empresa, só as da Plataforma. */
type CarregarConfiguracoes = (empresaId: string | null) => Promise<ConfiguracaoLida[]>;

export function carregarConfiguracoesDoBanco(tx: Transacao): CarregarConfiguracoes {
  return (empresaId) =>
    tx.consultar<ConfiguracaoLida>(sql`
      select empresa_id as "empresaId", chave, valor
      from erp.configuracoes
      where empresa_id is null or empresa_id = ${empresaId}`);
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
