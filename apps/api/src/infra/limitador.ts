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

/** Contagem por chave numa janela fixa (ex.: falhas do webhook por IP por minuto). */
export interface ContadorPorJanela {
  /** Soma um e devolve o total da janela atual. */
  somar(chave: string): Promise<number>;
}

export function criarContadorRedis(
  redis: Redis,
  prefixo: string,
  janelaMs: number,
): ContadorPorJanela {
  return {
    somar: async (chave) => {
      const resultado = await redis
        .multi()
        .incr(`${prefixo}:${chave}`)
        .pexpire(`${prefixo}:${chave}`, janelaMs, "NX")
        .exec();
      return Number(resultado?.[0]?.[1] ?? 0);
    },
  };
}

/** Só para desenvolvimento e testes (sem Redis). */
export function criarContadorEmMemoria(
  janelaMs: number,
  agora: () => number = Date.now,
): ContadorPorJanela {
  const janelas = new Map<string, { ate: number; total: number }>();
  return {
    somar: (chave) => {
      const atual = janelas.get(chave);
      const janela = atual && atual.ate > agora() ? atual : { ate: agora() + janelaMs, total: 0 };
      janela.total += 1;
      janelas.set(chave, janela);
      return Promise.resolve(janela.total);
    },
  };
}
