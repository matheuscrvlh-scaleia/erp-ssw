import {
  type DadosDePropagarClassificacao,
  FILA_DE_RECALCULO,
  JOB_PROPAGAR_CLASSIFICACAO,
} from "@erp/shared/jobs/recalculo";
import { Queue } from "bullmq";
import { type Redis } from "ioredis";

/** Recálculos em lote que a API entrega ao worker. */
export interface FilaDeRecalculo {
  propagarClassificacao(dados: DadosDePropagarClassificacao): Promise<void>;
  fechar(): Promise<void>;
}

export function criarFilaDeRecalculo(redis: Redis): FilaDeRecalculo {
  // Mesmo prefixo e opções padrão do worker (apps/worker/src/jobs/registro.ts).
  const fila = new Queue(FILA_DE_RECALCULO, {
    connection: redis,
    prefix: "erp",
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  return {
    propagarClassificacao: async (dados) => {
      await fila.add(JOB_PROPAGAR_CLASSIFICACAO, dados);
    },
    fechar: () => fila.close(),
  };
}
