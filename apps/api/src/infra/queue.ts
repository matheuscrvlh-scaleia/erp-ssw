/**
 * Pedido de trabalho para os jobs do ERP (BullMQ no Redis do ERP, rodando no processo da API).
 * A implementação é de `jobs/iniciar.ts`; sem Redis, a fila fica desligada.
 */
import { type JobEnfileiravel } from "@erp/shared/jobs";

/** Todo job roda no contexto de uma empresa; o resto dos dados é validado pelo zod do job. */
export interface DadosDoJob {
  readonly empresaId: string;
  readonly [campo: string]: unknown;
}

/** Devolve se ficou na fila. */
export interface FilaDeJobs {
  /** Falso sem Redis: quem tem alternativa (fazer na hora) não deve contar com os jobs. */
  readonly ligada: boolean;
  enfileirar(job: JobEnfileiravel, dados: DadosDoJob): Promise<boolean>;
}

/** Sem Redis (desenvolvimento sem jobs): nada é enfileirado e a tela avisa. */
export const filaDesligada: FilaDeJobs = {
  ligada: false,
  enfileirar: () => Promise.resolve(false),
};
