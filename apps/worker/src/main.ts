import { setTimeout as esperar } from "node:timers/promises";

import { comContexto, conectarBanco, type ContextoBanco, type Transacao } from "@erp/db";
import { lerChavesDeSegredo } from "@erp/db/segredos";
import {
  criarClienteSftp,
  criarEnfileirador,
  criarFilaDeAplicacao,
  criarProgressos,
  criarRepositorioProjecoesRomaneio,
  criarRepositorioDeRetencao,
  criarRepositorioIngestao,
  criarTravas,
} from "@erp/ingestao/infra";
import { filaDoJob, PREFIXO_DAS_FILAS } from "@erp/shared/ingestao";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { pino } from "pino";

import { agendamentosDesejados, sincronizarAgendamentos } from "./agendamentos/agendamentos";
import {
  agendamentosDeIngestao,
  criarDespachante,
  type Enfileirador,
} from "./agendamentos/ingestao";
import { criarRepositorioAgendamentos } from "./agendamentos/repositorio";
import { carregarAmbiente } from "./config/env";
import { criarJobBi2_0017 } from "./fontes/bi2/job";
import { criarRepositorioBi2 } from "./fontes/bi2/repositorio";
import { criarCofre } from "./fontes/comum/integracao";
import { criarRepositorioCteNucleo } from "./fontes/comum/repositorio-cte";
import { criarRepositorioIntegracoes } from "./fontes/comum/repositorio-integracoes";
import { criarCofreDeToken } from "./fontes/ssw-api/cofre-de-token";
import { criarJobTokenSsw } from "./fontes/ssw-api/job";
import { jobWebhookSsw } from "./fontes/webhook/job";
import { criarRepositorioWebhook } from "./fontes/webhook/repositorio";
import { criarJobsDaIngestao } from "./jobs/ingestao/jobs";
import { limparIngestaoSsw, limparSessoes } from "./jobs/manutencao/job";
import { criarRepositorioManutencao } from "./jobs/manutencao/repositorio";
import { recalcularPrazos } from "./jobs/prazos/job";
import { criarRepositorioPrazosDoWorker } from "./jobs/prazos/repositorio";
import {
  recalcularProjecoesRomaneio,
  reconstruirProjecoesRomaneio,
} from "./jobs/projecoes-romaneio/job";
import { propagarClassificacao } from "./jobs/recalculo/job";
import { criarRepositorioRecalculo } from "./jobs/recalculo/repositorio";
import {
  type DefinicaoDeJob,
  type ExecutorDoWorker,
  FILAS,
  OPCOES_PADRAO_DO_JOB,
  type RepositoriosDoWorker,
} from "./jobs/registro";
import { criarRepositorioSlaArquivos } from "./jobs/sla-arquivos/repositorio";
import { criarProcessador } from "./processador";
import { criarServidorDeSaude } from "./saude";

const PRAZO_DE_DESLIGAMENTO_MS = 30_000;

const ambiente = carregarAmbiente(process.env);
const chavesDeSegredo = ambiente.SEGREDOS_CHAVES
  ? lerChavesDeSegredo(ambiente.SEGREDOS_CHAVES, ambiente.SEGREDOS_CHAVE_ATUAL)
  : null;
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

function repositorios(tx: Transacao, { empresaId }: ContextoBanco): RepositoriosDoWorker {
  return {
    agendamentos: criarRepositorioAgendamentos(tx),
    manutencao: criarRepositorioManutencao(tx),
    integracoes: criarRepositorioIntegracoes(tx),
    cteNucleo: criarRepositorioCteNucleo(tx, empresaId),
    bi2: criarRepositorioBi2(tx, empresaId),
    webhook: criarRepositorioWebhook(tx, empresaId),
    ingestao: (id) => criarRepositorioIngestao(tx, id, null),
    retencaoDaIngestao: criarRepositorioDeRetencao(tx),
    slaArquivos: criarRepositorioSlaArquivos(tx),
    prazos: criarRepositorioPrazosDoWorker(tx),
    projecoesRomaneio: criarRepositorioProjecoesRomaneio(tx, empresaId),
    recalculo: criarRepositorioRecalculo(tx),
  };
}
const executar: ExecutorDoWorker = (contexto, fn) =>
  comContexto(conexao.banco, contexto, (tx) => fn(repositorios(tx, contexto)));

const filas = new Map(
  FILAS.map(({ nome }) => [
    nome,
    new Queue(nome, {
      connection: redis,
      defaultJobOptions: OPCOES_PADRAO_DO_JOB,
      prefix: PREFIXO_DAS_FILAS,
    }),
  ]),
);

const enfileirador: Enfileirador = {
  enfileirar: async (job, dados, { deduplicar }) => {
    const fila = filas.get(filaDoJob(job));
    if (!fila) throw new Error(`Fila do job ${job} não existe.`);
    await fila.add(job, dados, deduplicar ? { deduplication: { id: deduplicar } } : {});
  },
};

const cofre = criarCofre(chavesDeSegredo);
// Jobs de outros domínios que a ingestão pede (projeções do Romaneio, 050 de Coletas).
const enfileiradorDeDominios = criarEnfileirador(redis);
/** Todos os jobs do sistema. Job novo entra aqui. */
const JOBS: readonly DefinicaoDeJob[] = [
  limparSessoes,
  limparIngestaoSsw,
  criarDespachante(enfileirador),
  criarJobBi2_0017({ buscar: fetch, cofre }),
  criarJobTokenSsw({
    buscar: fetch,
    cofre,
    tokens: criarCofreDeToken(redis, chavesDeSegredo),
    esperar: (ms) => esperar(ms),
  }),
  jobWebhookSsw,
  ...criarJobsDaIngestao({
    fila: criarFilaDeAplicacao(redis),
    travas: criarTravas(redis),
    progressos: criarProgressos(redis),
    enfileirador: enfileiradorDeDominios,
    sftp: criarClienteSftp(),
    cofre,
    sftpDoAmbiente: ambiente,
    esperar: (ms) => esperar(ms),
  }),
  recalcularPrazos,
  recalcularProjecoesRomaneio,
  reconstruirProjecoesRomaneio,
  propagarClassificacao,
];

const processar = criarProcessador({ jobs: JOBS, executar, log, agora: () => new Date() });
const filasComJob = FILAS.filter((f) => JOBS.some((j) => j.fila === f.nome));
for (const { nome, concorrenciaGlobal } of filasComJob) {
  if (concorrenciaGlobal !== undefined)
    await filas.get(nome)?.setGlobalConcurrency(concorrenciaGlobal);
}
const workers = filasComJob.map(({ nome, concorrencia }) => {
  const worker = new Worker(nome, processar, {
    connection: redis,
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

const empresas = ambiente.AGENDAMENTOS_LIGADOS
  ? await executar({ empresaId: null, usuarioId: null, plataforma: true }, ({ agendamentos }) =>
      agendamentos.empresasAtivas(),
    )
  : [];
const registrados = new Set(JOBS.map((j) => j.nome));
for (const fila of filas.values()) {
  const jobsDaFila = JOBS.filter((j) => j.fila === fila.name);
  const desejados = ambiente.AGENDAMENTOS_LIGADOS
    ? [
        ...agendamentosDesejados(jobsDaFila, empresas),
        ...(fila.name === "agendador"
          ? agendamentosDeIngestao(ambiente.INGESTAO_JOBS_LIGADOS, registrados)
          : []),
      ]
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
log.info({ filas: filasComJob.map((f) => f.nome), porta: ambiente.PORTA_SAUDE }, "worker no ar");

/** Para de pegar jobs, espera os que estão rodando terminarem e fecha as conexões. */
async function desligar(sinal: string) {
  log.info({ sinal }, "desligando");
  setTimeout(() => {
    log.error("desligamento passou do prazo; saindo à força");
    process.exit(1);
  }, PRAZO_DE_DESLIGAMENTO_MS).unref();
  saude.close();
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([...filas.values()].map((f) => f.close()));
  await enfileiradorDeDominios.fechar();
  await conexao.encerrar();
  await redis.quit();
  process.exit(0);
}

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.once(sinal, () => void desligar(sinal));
}
