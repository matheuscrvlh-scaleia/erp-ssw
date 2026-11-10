/** Enfileira jobs no BullMQ (uma `Queue` por fila, reaproveitada). */
import { OPCOES_PADRAO_DO_JOB, PREFIXO_DAS_FILAS } from "@erp/shared/ingestao";
import { Queue } from "bullmq";
import { type Redis } from "ioredis";

import { type Enfileirador } from "../casos-de-uso/portas";

export function criarEnfileirador(redis: Redis): Enfileirador & { fechar(): Promise<void> } {
  const filas = new Map<string, Queue>();
  const fila = (nome: string) => {
    let q = filas.get(nome);
    if (!q) {
      q = new Queue(nome, {
        connection: redis,
        prefix: PREFIXO_DAS_FILAS,
        defaultJobOptions: OPCOES_PADRAO_DO_JOB,
      });
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
