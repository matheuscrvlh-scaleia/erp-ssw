/**
 * Cache das configurações por empresa (o que todas as telas leem a cada carga). Vale 5 minutos;
 * salvar no Admin invalida na hora nesta instância (as demais pegam o valor novo no vencimento).
 * origem: config.server.ts (sistema atual)
 */
export const VALIDADE_DO_CACHE_MS = 5 * 60_000;

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
