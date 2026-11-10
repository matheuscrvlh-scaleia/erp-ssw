import { duracaoDoBloqueioMs } from "@erp/dominio/autenticacao";
import { type Redis } from "ioredis";

/**
 * Contador de falhas de login com bloqueio progressivo, para chaves que não estão no banco:
 * IP e e-mail que não existe (a conta existente usa as colunas de `usuarios`).
 */
export interface LimitadorDeFalhas {
  /** Milissegundos até liberar (0 = livre). */
  bloqueioRestanteMs(chave: string): Promise<number>;
  registrarFalha(chave: string, toleradas: number): Promise<void>;
}

/** Falhas antigas deixam de contar depois de um dia sem novas tentativas. */
const JANELA_DAS_FALHAS_MS = 24 * 60 * 60_000;

export function criarLimitadorRedis(redis: Redis): LimitadorDeFalhas {
  return {
    bloqueioRestanteMs: async (chave) => Math.max(0, await redis.pttl(`login:bloqueio:${chave}`)),
    registrarFalha: async (chave, toleradas) => {
      const resultado = await redis
        .multi()
        .incr(`login:falhas:${chave}`)
        .pexpire(`login:falhas:${chave}`, JANELA_DAS_FALHAS_MS)
        .exec();
      const falhas = Number(resultado?.[0]?.[1] ?? 0);
      const duracao = duracaoDoBloqueioMs(falhas, toleradas);
      if (duracao > 0) await redis.set(`login:bloqueio:${chave}`, "1", "PX", duracao);
    },
  };
}

/** Só para desenvolvimento e testes (sem Redis): estado na memória do processo. */
export function criarLimitadorEmMemoria(agora: () => number = Date.now): LimitadorDeFalhas {
  const falhas = new Map<string, number>();
  const bloqueios = new Map<string, number>();
  return {
    bloqueioRestanteMs: (chave) =>
      Promise.resolve(Math.max(0, (bloqueios.get(chave) ?? 0) - agora())),
    registrarFalha: (chave, toleradas) => {
      const total = (falhas.get(chave) ?? 0) + 1;
      falhas.set(chave, total);
      const duracao = duracaoDoBloqueioMs(total, toleradas);
      if (duracao > 0) bloqueios.set(chave, agora() + duracao);
      return Promise.resolve();
    },
  };
}
