/**
 * Jobs do ERP no processo da API (ADR 0012): as filas (produtor, sempre que há Redis), os workers
 * do BullMQ (`JOBS_LIGADOS`) e os agendamentos pelos job schedulers (`AGENDAMENTOS_LIGADOS`). Com
 * várias réplicas, cada job vai a um só worker e cada agendamento existe uma vez no Redis: a
 * mesma rotina não roda duas vezes.
 */
import { type ChavesDeSegredo } from "@erp/db/secrets";
import { Queue, Worker } from "bullmq";
import { type FastifyBaseLogger } from "fastify";
import { type Redis } from "ioredis";

import { type FilaDeJobs } from "../infra/queue";
import { limparSessoes } from "./clean-sessions.job";
import { criarProcessador } from "./processor";
import { recalcularPrazos } from "./recalculate-deadlines.job";
import { propagarClassificacao, recalcularCtesDoCodigo } from "./recalculation.job";
import { criarJobRecifrarSegredos, NOME_DO_JOB_RECIFRAR } from "./reencrypt-secrets.job";
import {
  type DefinicaoDeJob,
  type ExecutorDosJobs,
  FILAS,
  OPCOES_PADRAO_DO_JOB,
  PREFIXO_DAS_FILAS,
} from "./registry";
import { agendamentosDesejados, sincronizarAgendamentos } from "./schedules";

interface FilasDosJobs {
  fila: FilaDeJobs;
  /** As filas por nome (os agendamentos são gravados nelas). */
  filas: ReadonlyMap<string, Queue>;
  fechar(): Promise<void>;
}

interface ConfigDosWorkers {
  /** Conexão dos workers: o BullMQ exige `maxRetriesPerRequest: null`. */
  conexao: Redis;
  executar: ExecutorDosJobs;
  log: FastifyBaseLogger;
  chavesDeSegredo: ChavesDeSegredo | null;
  agendamentosLigados: boolean;
}

interface WorkersDosJobs {
  /** Falha se algum worker do BullMQ parou (vai para o `/readyz`). */
  verificar(): Promise<void>;
  /** Para de pegar job e espera os em andamento. */
  fechar(): Promise<void>;
}

/** Todos os jobs do ERP. Job novo entra aqui. */
function definicoes(chaves: ChavesDeSegredo | null): readonly DefinicaoDeJob[] {
  return [
    limparSessoes,
    criarJobRecifrarSegredos(chaves),
    recalcularPrazos,
    propagarClassificacao,
    recalcularCtesDoCodigo,
  ];
}

const PLATAFORMA = { empresaId: null, usuarioId: null, plataforma: true } as const;

function criarFila(redis: Redis, nome: string): Queue {
  return new Queue(nome, {
    connection: redis,
    prefix: PREFIXO_DAS_FILAS,
    defaultJobOptions: OPCOES_PADRAO_DO_JOB,
  });
}

/** Produtor: os módulos pedem jobs por aqui (pode dividir a conexão com o limite de taxa). */
export function criarFilasDosJobs(redis: Redis): FilasDosJobs {
  const filas = new Map<string, Queue>(FILAS.map(({ nome }) => [nome, criarFila(redis, nome)]));
  return {
    fila: {
      ligada: true,
      enfileirar: async (job, dados) => {
        const fila = filas.get(job.fila);
        if (!fila) throw new Error(`Fila do job ${job.nome} não existe.`);
        await fila.add(job.nome, dados);
        return true;
      },
    },
    filas,
    fechar: async () => {
      await Promise.all([...filas.values()].map((f) => f.close()));
    },
  };
}

/** Consumidor: um worker por fila nesta réplica e os agendamentos sincronizados com o Redis. */
export async function ligarWorkersDosJobs(
  filas: ReadonlyMap<string, Queue>,
  config: ConfigDosWorkers,
): Promise<WorkersDosJobs> {
  const { log } = config;
  const jobs = definicoes(config.chavesDeSegredo);
  const processar = criarProcessador({
    jobs,
    executar: config.executar,
    log,
    agora: () => new Date(),
  });
  const workers = FILAS.map(({ nome, concorrencia }) => {
    const worker = new Worker(nome, processar, {
      connection: config.conexao,
      concurrency: concorrencia,
      prefix: PREFIXO_DAS_FILAS,
    });
    worker.on("failed", (job, erro) => {
      log.error(
        { err: erro, job: job?.name, jobId: job?.id, tentativas: job?.attemptsMade },
        "job falhou",
      );
    });
    return worker;
  });

  const empresas = config.agendamentosLigados
    ? await config.executar(PLATAFORMA, ({ agendamentos }) => agendamentos.empresasAtivas())
    : [];
  for (const [nome, fila] of filas) {
    const desejados = config.agendamentosLigados
      ? agendamentosDesejados(
          jobs.filter((j) => j.fila === nome),
          empresas,
        )
      : [];
    const resultado = await sincronizarAgendamentos(fila, desejados);
    log.info({ fila: nome, ...resultado, ligados: config.agendamentosLigados }, "agendamentos");
  }
  log.info({ filas: FILAS.map((f) => f.nome) }, "jobs do ERP ligados");

  return {
    verificar: () =>
      workers.some((w) => !w.isRunning())
        ? Promise.reject(new Error("worker dos jobs parado"))
        : Promise.resolve(),
    fechar: async () => {
      await Promise.all(workers.map((w) => w.close()));
    },
  };
}

/**
 * `node dist/server.js --recifrar-segredos` (docs/deploy.md §5): só pede o job e sai; uma
 * réplica da API no ar com `JOBS_LIGADOS` o roda.
 */
export async function pedirRecifragemDeSegredos(redis: Redis): Promise<void> {
  const fila = criarFila(redis, "manutencao");
  await fila.add(NOME_DO_JOB_RECIFRAR, {});
  await fila.close();
}
