/**
 * Produtor do BullMQ da API (no mesmo Redis do worker): jobs dos módulos, disparo manual e status
 * das filas da ingestão (tela Diagnóstico SSW) e o enfileirador da ingestão por arquivo. Uma
 * `Queue` por fila, reaproveitada por todos; só produz e consulta (não consome).
 */
import { type Enfileirador } from "@erp/ingestao/casos-de-uso";
import {
  chaveDoTokenSsw,
  filaDoJob,
  type FilasDeIngestao,
  OPCOES_PADRAO_DO_JOB,
  PREFIXO_DAS_FILAS,
} from "@erp/shared/ingestao";
import { type JobEnfileiravel } from "@erp/shared/jobs";
import { z } from "@erp/shared/zod";
import { type Job, Queue } from "bullmq";
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

/** Sem Redis (desenvolvimento sem worker): nada é enfileirado e a tela avisa. */
export const filaDesligada: FilaDeJobs = {
  ligada: false,
  enfileirar: () => Promise.resolve(false),
};

export interface FilasDaApi {
  jobs: FilaDeJobs;
  ingestao: FilasDeIngestao;
  /** Porta `Enfileirador` de `@erp/ingestao` (FTP, ciclos), sobre as mesmas filas. */
  enfileirador: Enfileirador;
  fechar(): Promise<void>;
}

const INTERVALO_DA_ESPERA_MS = 500;
/** Quantos jobs recentes olhar para achar os da empresa (o histórico é de todas). */
const JANELA_DO_HISTORICO = 50;

const daEmpresa = z.object({ empresaId: z.string() });
const tokenGuardado = z.object({ geradoEm: z.iso.datetime() });

function ehDaEmpresa(job: Job, empresaId: string): boolean {
  const dados = daEmpresa.safeParse(job.data);
  return dados.success && dados.data.empresaId === empresaId;
}

const instante = (ms: number | undefined) => (ms === undefined ? null : new Date(ms));

/** Singleton: enquanto houver um job com este id esperando ou rodando, outro não entra. */
const deduplicacao = (id: string | null | undefined) => (id ? { deduplication: { id } } : {});

export function criarFilasBullmq(redis: Redis, esperar: (ms: number) => Promise<void>): FilasDaApi {
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

  const ingestao: FilasDeIngestao = {
    enfileirar: async (job, dados, { deduplicar }) => {
      const criado = await fila(filaDoJob(job)).add(job, dados, deduplicacao(deduplicar));
      if (!criado.id) throw new Error("A fila não devolveu o id do job.");
      return criado.id;
    },

    aguardar: async (job, jobId, prazoMs) => {
      const q = fila(filaDoJob(job));
      for (let gasto = 0; gasto <= prazoMs; gasto += INTERVALO_DA_ESPERA_MS) {
        const atual = await q.getJob(jobId);
        if (!atual) return { tipo: "falhou", erro: "O job sumiu da fila antes de terminar." };
        const estado = await atual.getState();
        if (estado === "completed") {
          const valor: unknown = atual.returnvalue;
          return { tipo: "concluido", valor };
        }
        if (estado === "failed") return { tipo: "falhou", erro: atual.failedReason };
        await esperar(INTERVALO_DA_ESPERA_MS);
      }
      return { tipo: "pendente" };
    },

    status: async (job, empresaId) => {
      const q = fila(filaDoJob(job));
      const [contagem, agendamento, falhos, concluidos] = await Promise.all([
        q.getJobCounts("wait", "prioritized", "active", "delayed", "failed"),
        fila("agendador").getJobScheduler(`ingestao:${job}`),
        q.getFailed(0, JANELA_DO_HISTORICO - 1),
        q.getCompleted(0, JANELA_DO_HISTORICO - 1),
      ]);
      return {
        agendado: agendamento !== undefined,
        proximaExecucao: instante(agendamento?.next),
        aguardando: (contagem.wait ?? 0) + (contagem.prioritized ?? 0),
        ativos: contagem.active ?? 0,
        atrasados: contagem.delayed ?? 0,
        falhos: contagem.failed ?? 0,
        ultimaConclusao: instante(concluidos.find((j) => ehDaEmpresa(j, empresaId))?.finishedOn),
        ultimasFalhas: falhos
          .filter((j) => ehDaEmpresa(j, empresaId))
          .slice(0, 3)
          .map((j) => ({
            id: j.id ?? "",
            quando: instante(j.finishedOn),
            erro: j.failedReason,
            tentativas: j.attemptsMade,
          })),
      };
    },

    tokenSswGeradoEm: async (empresaId) => {
      const texto = await redis.get(chaveDoTokenSsw(empresaId));
      if (texto === null) return null;
      try {
        const lido = tokenGuardado.safeParse(JSON.parse(texto));
        return lido.success ? new Date(lido.data.geradoEm) : null;
      } catch {
        return null;
      }
    },

    esquecerTokenSsw: async (empresaId) => {
      await redis.del(chaveDoTokenSsw(empresaId));
    },
  };

  return {
    jobs: {
      ligada: true,
      enfileirar: async (job, dados) => {
        await fila(job.fila).add(job.nome, dados);
        return true;
      },
    },
    ingestao,
    enfileirador: {
      enfileirar: async (nomeDaFila, nome, dados, opcoes) => {
        await fila(nomeDaFila).add(nome, dados, deduplicacao(opcoes?.deduplicacao));
      },
    },
    fechar: async () => {
      await Promise.all([...filas.values()].map((q) => q.close()));
    },
  };
}
