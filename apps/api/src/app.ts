import { type ChavesDeSegredo, cifrarSegredo, decifrarSegredo } from "@erp/db/segredos";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { type Redis } from "ioredis";

import { type Ambiente } from "./config/env";
import { registrarTratadorDeErros } from "./http/tratador-erros";
import type { Armazenamento } from "./infra/armazenamento";
import { type Correio, criarCorreioDeDesenvolvimento } from "./infra/correio";
import type { FilaDeJobs } from "./infra/fila";
import { type ProvedorGoogle } from "./infra/google";
import { type LimitadorDeFalhas } from "./infra/limitador";
import { opcoesDeLog } from "./infra/log";
import { type ServicoDeSenhas } from "./infra/senhas";
import { type EmissorDeTokens } from "./infra/tokens";
import { type ClienteWorkerSsw } from "./infra/worker-ssw";
import { type DependenciasAhgora } from "./modulos/ahgora/casos-de-uso";
import { rotasAhgora } from "./modulos/ahgora/rotas";
import { type DependenciasAuth } from "./modulos/auth/casos-de-uso";
import { rotasAuth } from "./modulos/auth/rotas";
import { rotasBonificacaoEntrega } from "./modulos/bonificacao-entrega/rotas";
import { rotasCadastros } from "./modulos/cadastros/rotas";
import { rotasCalendario } from "./modulos/calendario/rotas";
import { rotasCodigosOcorrencia } from "./modulos/codigos-ocorrencia/rotas";
import { rotasColetas } from "./modulos/coletas/rotas";
import { rotasComprovantes } from "./modulos/comprovantes/rotas";
import {
  type CacheDeConfiguracoes,
  criarCacheDeConfiguracoes,
} from "./modulos/configuracoes/cache";
import { rotasConfiguracoes } from "./modulos/configuracoes/rotas";
import { rotasCtrc } from "./modulos/ctrc/rotas";
import { rotasFiltros } from "./modulos/filtros/rotas";
import { rotasHistorico } from "./modulos/historico/rotas";
import { rotasIngestao } from "./modulos/ingestao/rotas-admin";
import { rotasIngestaoSsw } from "./modulos/ingestao-ssw/rotas";
import { rotasListagem } from "./modulos/listagem/rotas";
import { rotasLogs } from "./modulos/logs/rotas";
import { rotasOcorrencias } from "./modulos/ocorrencias/rotas";
import { rotasPerformance } from "./modulos/performance/rotas";
import { rotasPlataforma } from "./modulos/plataforma/rotas";
import { rotasPrazoParceiro } from "./modulos/prazo-parceiro/rotas";
import { rotasPrazos } from "./modulos/prazos/rotas";
import { rotasRanking } from "./modulos/ranking/rotas";
import { rotasRomaneio } from "./modulos/romaneio/rotas";
import { type DependenciasUsuarios } from "./modulos/usuarios/casos-de-uso";
import { rotasUsuarios } from "./modulos/usuarios/rotas";
import {
  registrarDocumentacao,
  registrarMetricas,
  registrarSaude,
} from "./plugins/observabilidade";
import { registrarSeguranca } from "./plugins/seguranca";
import { pluginSessao } from "./plugins/sessao";
import { type ExecutorComContexto } from "./repositorios";

/** Tudo o que a API usa de fora. Produção monta em `server.ts`; os testes passam falsos. */
export interface Dependencias {
  ambiente: Ambiente;
  executar: ExecutorComContexto;
  verificarBanco: () => Promise<void>;
  redis: Redis | null;
  tokens: EmissorDeTokens;
  senhas: ServicoDeSenhas;
  limitador: LimitadorDeFalhas;
  /** Nulo = desenvolvimento sem SMTP (o e-mail vai para o log). */
  correio: Correio | null;
  google: ProvedorGoogle | null;
  /**
   * HTTP interno do worker-ssw (ADR 0012). Nulo = `WORKER_SSW_URL`/`WORKER_SSW_TOKEN` ausentes: as
   * ações de ingestão respondem 503 e as leituras continuam.
   */
  workerSsw: ClienteWorkerSsw | null;
  /** Fila dos jobs do ERP (recálculos); desligada sem Redis. */
  fila: FilaDeJobs;
  /** Saúde dos workers dos jobs do ERP (`JOBS_LIGADOS`); ausente = jobs desligados. */
  verificarJobs?: () => Promise<void>;
  /** Bucket dos logos; nulo = envio de logo não configurado. */
  armazenamento: Armazenamento | null;
  /** Chaves dos segredos de integração. Nulo = sem cofre: não salva senha nem confere o webhook. */
  chavesDeSegredo: ChavesDeSegredo | null;
  agora: () => Date;
  /**
   * Cache das configurações: o mesmo que os repositórios leem (`criarRepositorios`). Sem ele (os
   * testes, com repositórios falsos), um próprio, só para o Admin invalidar.
   */
  cacheDeConfiguracoes?: CacheDeConfiguracoes;
  /** Ponto (Ahgora): cofre de segredos, credencial de transição e HTTP. Sem ele, sem cofre. */
  ahgora?: DependenciasAhgora;
}

function urlDoLogo(ambiente: Ambiente) {
  return (caminho: string | null) =>
    caminho && ambiente.LOGO_URL_BASE ? new URL(caminho, `${ambiente.LOGO_URL_BASE}/`).href : null;
}

/** Monta a aplicação sem abrir porta: o `server.ts` escuta, os testes usam `inject`. */
export async function construirApp(deps: Dependencias): Promise<FastifyInstance> {
  const { ambiente } = deps;
  const app = Fastify({
    logger: opcoesDeLog(ambiente),
    // Só confia no X-Forwarded-For dos proxies conhecidos (o IP do cliente vale para o limite).
    trustProxy: (_endereco: string, salto: number) => salto < ambiente.PROXIES_CONFIAVEIS,
    bodyLimit: 1_048_576,
    requestIdHeader: "x-request-id",
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registrarTratadorDeErros(app);

  const comDocumentacao = ambiente.NODE_ENV !== "production";
  await registrarSeguranca(app, { ambiente, redis: deps.redis, comDocumentacao });
  if (comDocumentacao) await registrarDocumentacao(app);
  registrarMetricas(app, ambiente.METRICAS_TOKEN);
  const redis = deps.redis;
  registrarSaude(app, {
    verificacoes: {
      banco: deps.verificarBanco,
      ...(redis
        ? {
            redis: async () => {
              await redis.ping();
            },
          }
        : {}),
      ...(deps.verificarJobs ? { jobs: deps.verificarJobs } : {}),
    },
  });

  const acesso = { executar: deps.executar, agora: deps.agora, urlDoLogo: urlDoLogo(ambiente) };
  await app.register(pluginSessao, { ...acesso, tokens: deps.tokens });

  const auth: DependenciasAuth = {
    ...acesso,
    senhas: deps.senhas,
    tokens: deps.tokens,
    limitador: deps.limitador,
    correio: deps.correio ?? criarCorreioDeDesenvolvimento(app.log),
    refreshDias: ambiente.REFRESH_DIAS,
    webUrl: ambiente.WEB_URL,
  };
  await app.register(rotasAuth, {
    deps: auth,
    google: deps.google,
    googleRedirectUri: ambiente.GOOGLE_REDIRECT_URI ?? null,
  });
  await app.register(rotasCalendario, { agora: deps.agora });
  await app.register(rotasIngestao, { deps: { workerSsw: deps.workerSsw } });
  await app.register(rotasRomaneio, { agora: deps.agora });
  await app.register(rotasPrazoParceiro);
  await app.register(rotasOcorrencias, { agora: deps.agora });
  await app.register(rotasComprovantes);
  await app.register(rotasColetas, { agora: deps.agora });
  await app.register(rotasHistorico, { agora: deps.agora });
  await app.register(rotasCodigosOcorrencia, {
    agora: deps.agora,
    fila: deps.fila,
  });
  await app.register(rotasFiltros);
  await app.register(rotasListagem, { agora: deps.agora });
  await app.register(rotasCtrc, { agora: deps.agora });
  await app.register(rotasPerformance, { agora: deps.agora });
  const ahgora = deps.ahgora ?? { segredos: null, ambiente: {}, http: fetch };
  await app.register(rotasRanking, { agora: deps.agora, executar: deps.executar });
  await app.register(rotasBonificacaoEntrega, { ahgora });
  await app.register(rotasAhgora, { ahgora });

  const chaves = deps.chavesDeSegredo;
  await app.register(rotasIngestaoSsw, {
    deps: {
      workerSsw: deps.workerSsw,
      cifrador: chaves
        ? {
            cifrar: (texto, contexto) => cifrarSegredo(chaves, texto, contexto),
            decifrar: (segredo, contexto) => {
              try {
                return decifrarSegredo(chaves, segredo, contexto);
              } catch {
                return null;
              }
            },
          }
        : null,
      agora: deps.agora,
    },
  });

  const usuarios: DependenciasUsuarios = {
    correio: auth.correio,
    senhas: deps.senhas,
    webUrl: ambiente.WEB_URL,
    agora: deps.agora,
  };
  await app.register(rotasUsuarios, { deps: usuarios, executar: deps.executar });
  await app.register(rotasCadastros);
  await app.register(rotasConfiguracoes, {
    cache: deps.cacheDeConfiguracoes ?? criarCacheDeConfiguracoes(deps.agora),
  });
  await app.register(rotasPrazos, { fila: deps.fila });
  await app.register(rotasLogs, { executar: deps.executar });
  await app.register(rotasPlataforma, {
    executar: deps.executar,
    usuarios,
    armazenamento: deps.armazenamento,
    chavesDeSegredo: deps.chavesDeSegredo,
    urlDoLogo: acesso.urlDoLogo,
    agora: deps.agora,
  });

  return app;
}
