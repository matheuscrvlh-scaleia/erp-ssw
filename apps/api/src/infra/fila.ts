import { OPCOES_PADRAO_DO_JOB, PREFIXO_DAS_FILAS } from "@erp/shared/ingestao";
import { type JobEnfileiravel } from "@erp/shared/jobs";
import { Queue } from "bullmq";
import { type Redis } from "ioredis";

/** Pedido de trabalho para o worker (BullMQ). Devolve se ficou na fila. */
export interface FilaDeJobs {
  enfileirar(job: JobEnfileiravel, dados: { empresaId: string }): Promise<boolean>;
}

export function criarFilaBullmq(redis: Redis): FilaDeJobs & { fechar(): Promise<void> } {
  const filas = new Map<string, Queue>();
  const fila = (nome: string) => {
    let existente = filas.get(nome);
    if (!existente) {
      existente = new Queue(nome, {
        connection: redis,
        prefix: PREFIXO_DAS_FILAS,
        defaultJobOptions: OPCOES_PADRAO_DO_JOB,
      });
      filas.set(nome, existente);
    }
    return existente;
  };
  return {
    enfileirar: async (job, dados) => {
      await fila(job.fila).add(job.nome, dados);
      return true;
    },
    fechar: async () => {
      await Promise.all([...filas.values()].map((f) => f.close()));
    },
  };
}

/** Sem Redis (desenvolvimento sem worker): nada é enfileirado e a tela avisa. */
export const filaDesligada: FilaDeJobs = { enfileirar: () => Promise.resolve(false) };
