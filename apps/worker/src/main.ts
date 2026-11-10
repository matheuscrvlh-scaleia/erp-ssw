import { comContexto, conectarBanco, type Transacao } from "@erp/db";
import { lerChavesDeSegredo } from "@erp/db/segredos";
import {
  criarClienteSftp,
  criarCredenciais,
  criarEnfileirador,
  criarFilaDeAplicacao,
  criarProgressos,
  criarRepositorioDeRetencao,
  criarRepositorioIngestao,
  criarTravas,
  lerIntegracao,
} from "@erp/ingestao/infra";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { pino } from "pino";

import { agendamentosDesejados, sincronizarAgendamentos } from "./agendamentos/agendamentos";
import { criarRepositorioAgendamentos } from "./agendamentos/repositorio";
import { carregarAmbiente } from "./config/env";
import { criarJobsDaIngestao } from "./jobs/ingestao/jobs";
import { limparSessoes } from "./jobs/manutencao/job";
import { criarRepositorioManutencao } from "./jobs/manutencao/repositorio";
import {
  type DefinicaoDeJob,
  type ExecutorDoWorker,
  FILAS,
  OPCOES_PADRAO_DO_JOB,
  type RepositoriosDoWorker,
} from "./jobs/registro";
import { criarProcessador } from "./processador";
import { criarServidorDeSaude } from "./saude";

const PRAZO_DE_DESLIGAMENTO_MS = 30_000;

const ambiente = carregarAmbiente(process.env);
const log = pino({
  level: ambiente.LOG_NIVEL,
  base: { servico: "erp-worker" },
  redact: { paths: ["*.senha", "*.token", "*.segredo"], censor: "[oculto]" },
});

const conexao = conectarBanco({
  url: ambiente.DATABASE_URL,
  maxConexoes: ambiente.DB_MAX_CONEXOES,
  timeoutConsultaMs: ambiente.DB_TIMEOUT_CONSULTA_MS,
  nomeAplicacao: "erp-worker",
});
// O BullMQ exige maxRetriesPerRequest nulo nas conexões de worker.
const redis = new Redis(ambiente.REDIS_URL, { maxRetriesPerRequest: null });

function repositorios(tx: Transacao): RepositoriosDoWorker {
  return {
    agendamentos: criarRepositorioAgendamentos(tx),
    manutencao: criarRepositorioManutencao(tx),
    ingestao: (empresaId) => criarRepositorioIngestao(tx, empresaId, null),
    retencaoDaIngestao: criarRepositorioDeRetencao(tx),
    integracao: (empresaId, tipo) => lerIntegracao(tx, empresaId, tipo),
  };
}
const executar: ExecutorDoWorker = (contexto, fn) =>
  comContexto(conexao.banco, contexto, (tx) => fn(repositorios(tx)));

const chavesDeSegredo =
  ambiente.SEGREDOS_CHAVES && ambiente.SEGREDOS_CHAVE_ATUAL
    ? lerChavesDeSegredo(ambiente.SEGREDOS_CHAVES, ambiente.SEGREDOS_CHAVE_ATUAL)
    : null;
const enfileirador = criarEnfileirador(redis);

/** Todos os jobs do sistema. Job novo entra aqui. */
const JOBS: readonly DefinicaoDeJob[] = [
  limparSessoes,
  ...criarJobsDaIngestao({
    fila: criarFilaDeAplicacao(redis),
    travas: criarTravas(redis),
    progressos: criarProgressos(redis),
    enfileirador,
    sftp: criarClienteSftp(),
    credenciais: criarCredenciais(
      (empresaId) =>
        executar({ empresaId, usuarioId: null, plataforma: false }, ({ integracao }) =>
          integracao(empresaId, "sftp"),
        ),
      chavesDeSegredo,
      ambiente,
    ),
    esperar: (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
    agendada: ambiente.INGESTAO_AGENDADA,
  }),
];

const filas = FILAS.map(
  ({ nome }) =>
    new Queue(nome, { connection: redis, defaultJobOptions: OPCOES_PADRAO_DO_JOB, prefix: "erp" }),
);
const processar = criarProcessador({ jobs: JOBS, executar, log, agora: () => new Date() });
const workers = FILAS.map(({ nome, concorrencia }) => {
  const worker = new Worker(nome, processar, {
    connection: redis,
    concurrency: concorrencia,
    prefix: "erp",
  });
  worker.on("failed", (job, erro) => {
    log.error(
      { err: erro, job: job?.name, jobId: job?.id, tentativas: job?.attemptsMade },
      "job falhou",
    );
  });
  return worker;
});

const empresas = ambiente.AGENDAMENTOS_LIGADOS
  ? await executar({ empresaId: null, usuarioId: null, plataforma: true }, ({ agendamentos }) =>
      agendamentos.empresasAtivas(),
    )
  : [];
for (const fila of filas) {
  const jobsDaFila = JOBS.filter((j) => j.fila === fila.name);
  const desejados = ambiente.AGENDAMENTOS_LIGADOS
    ? agendamentosDesejados(jobsDaFila, empresas)
    : [];
  const resultado = await sincronizarAgendamentos(fila, desejados);
  log.info(
    { fila: fila.name, ...resultado, ligados: ambiente.AGENDAMENTOS_LIGADOS },
    "agendamentos",
  );
}

const saude = criarServidorDeSaude(async () => {
  await redis.ping();
  if (workers.some((w) => !w.isRunning())) throw new Error("worker parado");
});
saude.listen(ambiente.PORTA_SAUDE);
log.info({ filas: FILAS.map((f) => f.nome), porta: ambiente.PORTA_SAUDE }, "worker no ar");

/** Para de pegar jobs, espera os que estão rodando terminarem e fecha as conexões. */
async function desligar(sinal: string) {
  log.info({ sinal }, "desligando");
  setTimeout(() => {
    log.error("desligamento passou do prazo; saindo à força");
    process.exit(1);
  }, PRAZO_DE_DESLIGAMENTO_MS).unref();
  saude.close();
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(filas.map((f) => f.close()));
  await enfileirador.fechar();
  await conexao.encerrar();
  await redis.quit();
  process.exit(0);
}

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.once(sinal, () => void desligar(sinal));
}
