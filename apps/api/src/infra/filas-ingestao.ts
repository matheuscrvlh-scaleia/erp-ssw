/**
 * Filas da ingestão vistas pela API (BullMQ no mesmo Redis do worker): disparo manual, espera do
 * resultado, status para a tela Diagnóstico SSW e o token da SSW API guardado pelo worker.
 */
import {
  chaveDoTokenSsw,
  filaDoJob,
  OPCOES_PADRAO_DO_JOB,
  PREFIXO_DAS_FILAS,
} from "@erp/shared/ingestao";
import { z } from "@erp/shared/zod";
import { type Job, Queue } from "bullmq";
import { type Redis } from "ioredis";

import { type FilasDeIngestao } from "../modulos/ingestao-ssw/casos-de-uso";

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

export function criarFilasDeIngestao(
  redis: Redis,
  esperar: (ms: number) => Promise<void>,
): FilasDeIngestao & { fechar(): Promise<void> } {
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
    enfileirar: async (job, dados, { deduplicar }) => {
      const criado = await fila(filaDoJob(job)).add(
        job,
        dados,
        deduplicar ? { deduplication: { id: deduplicar } } : {},
      );
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

    fechar: async () => {
      await Promise.all([...filas.values()].map((q) => q.close()));
    },
  };
}
