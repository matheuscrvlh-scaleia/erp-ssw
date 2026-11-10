import { comContexto, conectarBanco } from "@erp/db";
import { lerChavesDeSegredo } from "@erp/db/segredos";
import { Redis } from "ioredis";

import { construirApp } from "./app";
import { carregarAmbiente } from "./config/env";
import { criarArmazenamentoS3 } from "./infra/armazenamento";
import { criarCorreioSmtp } from "./infra/correio";
import { criarFilaBullmq, filaDesligada } from "./infra/fila";
import { criarProvedorGoogle } from "./infra/google";
import { criarLimitadorEmMemoria, criarLimitadorRedis } from "./infra/limitador";
import { criarServicoDeSenhas } from "./infra/senhas";
import { criarEmissorDeTokens, lerChavesAnteriores } from "./infra/tokens";
import { criarRepositorios } from "./repositorios";

/** Tempo para terminar as requisições em andamento depois do SIGTERM. */
const PRAZO_DE_DESLIGAMENTO_MS = 10_000;

const ambiente = carregarAmbiente(process.env);

const conexao = conectarBanco({
  url: ambiente.DATABASE_URL,
  maxConexoes: ambiente.DB_MAX_CONEXOES,
  timeoutConsultaMs: ambiente.DB_TIMEOUT_CONSULTA_MS,
  nomeAplicacao: "erp-api",
});
const redis = ambiente.REDIS_URL
  ? new Redis(ambiente.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 2_000 })
  : null;

const fila = redis ? criarFilaBullmq(redis) : null;

const chavesDeSegredo = ambiente.SEGREDOS_CHAVES
  ? lerChavesDeSegredo(ambiente.SEGREDOS_CHAVES, ambiente.SEGREDOS_CHAVE_ATUAL)
  : null;

const app = await construirApp({
  ambiente,
  executar: (contexto, fn) =>
    comContexto(conexao.banco, contexto, (tx) => fn(criarRepositorios(tx))),
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
  fila: fila ?? filaDesligada,
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
  agora: () => new Date(),
  ahgora: {
    segredos: chavesDeSegredo,
    ambiente: { usuario: ambiente.AHGORA_API_USUARIO, senha: ambiente.AHGORA_API_SENHA },
    http: fetch,
  },
});

app.addHook("onClose", async () => {
  await fila?.fechar();
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
