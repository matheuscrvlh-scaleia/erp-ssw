/** Enfileira jobs no BullMQ (uma `Queue` por fila, reaproveitada). */
import { Queue } from "bullmq";
import { type Redis } from "ioredis";

import { type Enfileirador } from "../casos-de-uso/portas";

/** Mesma política do worker: tentativas com espera exponencial e histórico curto. */
const OPCOES = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;

export function criarEnfileirador(redis: Redis): Enfileirador & { fechar(): Promise<void> } {
  const filas = new Map<string, Queue>();
  const fila = (nome: string) => {
    let q = filas.get(nome);
    if (!q) {
      q = new Queue(nome, { connection: redis, prefix: "erp", defaultJobOptions: OPCOES });
      filas.set(nome, q);
    }
    return q;
  };
  return {
    async enfileirar(nomeDaFila, nome, dados, opcoes) {
      await fila(nomeDaFila).add(
        nome,
        dados,
        opcoes?.deduplicacao ? { deduplication: { id: opcoes.deduplicacao } } : {},
      );
    },
    async fechar() {
      await Promise.all([...filas.values()].map((q) => q.close()));
    },
  };
}
