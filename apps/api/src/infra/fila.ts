import { OPCOES_PADRAO_DO_JOB, PREFIXO_DAS_FILAS } from "@erp/shared/ingestao";
import { type JobEnfileiravel } from "@erp/shared/jobs";
import { Queue } from "bullmq";
import { type Redis } from "ioredis";

/** Todo job roda no contexto de uma empresa; o resto dos dados é validado pelo zod do job. */
export interface DadosDoJob {
  readonly empresaId: string;
  readonly [campo: string]: unknown;
}

/** Pedido de trabalho para o worker (BullMQ). Devolve se ficou na fila. */
export interface FilaDeJobs {
  /** Falso sem Redis: quem tem alternativa (fazer na hora) não deve contar com o worker. */
  readonly ligada: boolean;
  enfileirar(job: JobEnfileiravel, dados: DadosDoJob): Promise<boolean>;
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
    ligada: true,
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
export const filaDesligada: FilaDeJobs = {
  ligada: false,
  enfileirar: () => Promise.resolve(false),
};
