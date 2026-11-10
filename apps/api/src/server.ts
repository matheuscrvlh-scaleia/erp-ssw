import { comContexto, conectarBanco, type ContextoBanco, type Transacao } from "@erp/db";
import { lerChavesDeSegredo } from "@erp/db/segredos";
import { Redis } from "ioredis";

import { construirApp } from "./app";
import { criarRepositorioCteNucleo } from "./compartilhado/gravacao-cte";
import { carregarAmbiente } from "./config/env";
import { criarArmazenamentoS3 } from "./infra/armazenamento";
import { criarCorreioSmtp } from "./infra/correio";
import { filaDesligada } from "./infra/fila";
import { criarProvedorGoogle } from "./infra/google";
import { criarLimitadorEmMemoria, criarLimitadorRedis } from "./infra/limitador";
import { criarServicoDeSenhas } from "./infra/senhas";
import { criarEmissorDeTokens, lerChavesAnteriores } from "./infra/tokens";
import { criarClienteWorkerSsw } from "./infra/worker-ssw";
import { criarFilasDosJobs, ligarWorkersDosJobs, pedirRecifragemDeSegredos } from "./jobs/iniciar";
import { criarRepositorioManutencao } from "./jobs/manutencao/repositorio";
import { criarRepositorioSegredos } from "./jobs/manutencao/repositorio-segredos";
import { criarRepositorioPrazosDoJob } from "./jobs/prazos/repositorio";
import { criarRepositorioRecalculo } from "./jobs/recalculo/repositorio";
import { type RepositoriosDosJobs } from "./jobs/registro";
import { criarRepositorioAgendamentos } from "./jobs/repositorio-agendamentos";
import { criarCacheDeConfiguracoes } from "./modulos/configuracoes/cache";
import { criarRepositorios } from "./repositorios";

/**
 * Tempo para terminar as requisições e os jobs em andamento depois do SIGTERM. O job que não
 * terminar volta para a fila (o BullMQ o retoma; os jobs do ERP podem repetir).
 */
const PRAZO_DE_DESLIGAMENTO_MS = 25_000;

const ambiente = carregarAmbiente(process.env);

const redis = ambiente.REDIS_URL
  ? new Redis(ambiente.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2_000 })
  : null;

// Subcomando: `node dist/server.js --recifrar-segredos` só pede o job (docs/deploy.md §5.3) e sai.
if (process.argv.includes("--recifrar-segredos")) {
  if (redis === null) throw new Error("--recifrar-segredos precisa de REDIS_URL.");
  await pedirRecifragemDeSegredos(redis);
  await redis.quit();
  process.stdout.write("job recifrar-segredos enfileirado\n");
  process.exit(0);
}

const conexao = conectarBanco({
  url: ambiente.DATABASE_URL,
  maxConexoes: ambiente.DB_MAX_CONEXOES,
  timeoutConsultaMs: ambiente.DB_TIMEOUT_CONSULTA_MS,
  nomeAplicacao: "erp-api",
});

const chavesDeSegredo = ambiente.SEGREDOS_CHAVES
  ? lerChavesDeSegredo(ambiente.SEGREDOS_CHAVES, ambiente.SEGREDOS_CHAVE_ATUAL)
  : null;

function repositoriosDosJobs(tx: Transacao, { empresaId }: ContextoBanco): RepositoriosDosJobs {
  return {
    agendamentos: criarRepositorioAgendamentos(tx),
    manutencao: criarRepositorioManutencao(tx),
    // Só os jobs por empresa gravam CT-e: sem empresa no contexto, falha no uso.
    get cteNucleo() {
      if (empresaId === null) throw new Error("Gravação de CT-e sem empresa no contexto.");
      return criarRepositorioCteNucleo(tx, empresaId);
    },
    prazos: criarRepositorioPrazosDoJob(tx),
    recalculo: criarRepositorioRecalculo(tx),
    segredos: criarRepositorioSegredos(tx),
  };
}

// Produtor dos jobs do ERP (sempre que há Redis); os workers ligam depois do app (usam o log dele).
const filasDosJobs = redis ? criarFilasDosJobs(redis) : null;

const agora = () => new Date();
const cacheDeConfiguracoes = criarCacheDeConfiguracoes(agora);

const workerSsw =
  ambiente.WORKER_SSW_URL && ambiente.WORKER_SSW_TOKEN
    ? criarClienteWorkerSsw({
        url: ambiente.WORKER_SSW_URL,
        token: ambiente.WORKER_SSW_TOKEN,
        buscar: fetch,
        aoFalhar: (erro, operacao) => {
          app.log.warn({ err: erro, operacao }, "worker-ssw não respondeu");
        },
      })
    : null;

const app = await construirApp({
  ambiente,
  executar: (contexto, fn) =>
    comContexto(conexao.banco, contexto, (tx) =>
      fn(criarRepositorios(tx, contexto, cacheDeConfiguracoes)),
    ),
  verificarBanco: conexao.verificar,
  redis,
  tokens: criarEmissorDeTokens({
    chavePrivadaPem: ambiente.JWT_CHAVE_PRIVADA,
    kid: ambiente.JWT_KID,
    chavesAnteriores: lerChavesAnteriores(ambiente.JWT_CHAVES_ANTERIORES),
    emissor: ambiente.JWT_EMISSOR,
    audiencia: ambiente.JWT_AUDIENCIA,
  }),
  senhas: criarServicoDeSenhas(),
  limitador: redis ? criarLimitadorRedis(redis) : criarLimitadorEmMemoria(),
  correio: ambiente.SMTP_HOST
    ? criarCorreioSmtp({
        host: ambiente.SMTP_HOST,
        porta: ambiente.SMTP_PORTA,
        seguro: ambiente.SMTP_SEGURO,
        usuario: ambiente.SMTP_USUARIO,
        senha: ambiente.SMTP_SENHA,
        remetente: ambiente.EMAIL_REMETENTE,
      })
    : null,
  google:
    ambiente.GOOGLE_CLIENT_ID && ambiente.GOOGLE_CLIENT_SECRET && ambiente.GOOGLE_REDIRECT_URI
      ? criarProvedorGoogle({
          clientId: ambiente.GOOGLE_CLIENT_ID,
          clientSecret: ambiente.GOOGLE_CLIENT_SECRET,
          redirectUri: ambiente.GOOGLE_REDIRECT_URI,
        })
      : null,
  workerSsw,
  fila: filasDosJobs?.fila ?? filaDesligada,
  ...(ambiente.JOBS_LIGADOS
    ? { verificarJobs: () => workers?.verificar() ?? Promise.resolve() }
    : {}),
  armazenamento:
    ambiente.S3_BUCKET && ambiente.S3_CHAVE_ACESSO && ambiente.S3_SEGREDO
      ? criarArmazenamentoS3({
          endpoint: ambiente.S3_ENDPOINT,
          regiao: ambiente.S3_REGIAO,
          bucket: ambiente.S3_BUCKET,
          chaveDeAcesso: ambiente.S3_CHAVE_ACESSO,
          segredo: ambiente.S3_SEGREDO,
          caminhoNoEstilo: ambiente.S3_CAMINHO_NO_ESTILO,
        })
      : null,
  chavesDeSegredo,
  agora,
  cacheDeConfiguracoes,
  ahgora: {
    segredos: chavesDeSegredo,
    ambiente: { usuario: ambiente.AHGORA_API_USUARIO, senha: ambiente.AHGORA_API_SENHA },
    http: fetch,
  },
});

// O BullMQ exige `maxRetriesPerRequest: null` na conexão dos workers (bloqueante, própria).
const conexaoDosWorkers =
  ambiente.JOBS_LIGADOS && ambiente.REDIS_URL
    ? new Redis(ambiente.REDIS_URL, { maxRetriesPerRequest: null })
    : null;
const workers =
  filasDosJobs && conexaoDosWorkers
    ? await ligarWorkersDosJobs(filasDosJobs.filas, {
        conexao: conexaoDosWorkers,
        executar: (contexto, fn) =>
          comContexto(conexao.banco, contexto, (tx) => fn(repositoriosDosJobs(tx, contexto))),
        log: app.log,
        chavesDeSegredo,
        agendamentosLigados: ambiente.AGENDAMENTOS_LIGADOS,
      })
    : null;

app.addHook("onClose", async () => {
  // Primeiro os jobs (param de pegar e terminam o que rodam), depois as conexões.
  await workers?.fechar();
  await filasDosJobs?.fechar();
  await conexaoDosWorkers?.quit();
  await conexao.encerrar();
  await redis?.quit();
});

async function desligar(sinal: string) {
  app.log.info({ sinal }, "desligando");
  const prazo = setTimeout(() => {
    app.log.error("desligamento passou do prazo; saindo à força");
    process.exit(1);
  }, PRAZO_DE_DESLIGAMENTO_MS);
  prazo.unref();
  await app.close();
  process.exit(0);
}

for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.once(sinal, () => void desligar(sinal));
}

await app.listen({ host: ambiente.HOST, port: ambiente.PORTA });
