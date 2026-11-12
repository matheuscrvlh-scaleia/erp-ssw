/**
 * Cache dos valores vigentes de configuração por empresa (os da empresa por cima dos padrões da
 * Plataforma), lido pelo `LeitorDeConfiguracoes` das telas (Listagem, Ocorrências, Romaneio, Prazo
 * do parceiro) e pelas configurações públicas. Vale 5 minutos; salvar no Admin invalida a empresa
 * na hora nesta instância (as demais instâncias pegam o valor novo no vencimento). A ingestão não
 * passa por aqui: lê do banco a cada execução.
 * origem: config.server.ts (sistema atual)
 */
const VALIDADE_DO_CACHE_MS = 5 * 60_000;

export interface CacheDeConfiguracoes {
  valores(
    empresaId: string,
    carregar: () => Promise<Map<string, string>>,
  ): Promise<Map<string, string>>;
  invalidar(empresaId: string): void;
}

export function criarCacheDeConfiguracoes(agora: () => Date): CacheDeConfiguracoes {
  const porEmpresa = new Map<string, { valores: Map<string, string>; expiraEm: number }>();
  return {
    valores: async (empresaId, carregar) => {
      const guardado = porEmpresa.get(empresaId);
      if (guardado && guardado.expiraEm > agora().getTime()) return guardado.valores;
      const valores = await carregar();
      porEmpresa.set(empresaId, { valores, expiraEm: agora().getTime() + VALIDADE_DO_CACHE_MS });
      return valores;
    },
    invalidar: (empresaId) => {
      porEmpresa.delete(empresaId);
    },
  };
}
