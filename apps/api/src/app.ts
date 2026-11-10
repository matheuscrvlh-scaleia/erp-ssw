import { type ChavesDeSegredo } from "@erp/db/segredos";
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
import { type DependenciasAuth } from "./modulos/auth/casos-de-uso";
import { rotasAuth } from "./modulos/auth/rotas";
import { rotasCadastros } from "./modulos/cadastros/rotas";
import { rotasCalendario } from "./modulos/calendario/rotas";
import { criarCacheDeConfiguracoes } from "./modulos/configuracoes/cache";
import { rotasConfiguracoes } from "./modulos/configuracoes/rotas";
import { rotasLogs } from "./modulos/logs/rotas";
import { rotasPlataforma } from "./modulos/plataforma/rotas";
import { rotasPrazos } from "./modulos/prazos/rotas";
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
  /** Fila do worker (recálculos); desligada sem Redis. */
  fila: FilaDeJobs;
  /** Bucket dos logos; nulo = envio de logo não configurado. */
  armazenamento: Armazenamento | null;
  /** Chaves dos segredos de integração; nulo = cofre não configurado. */
  chavesDeSegredo: ChavesDeSegredo | null;
  agora: () => Date;
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

  const usuarios: DependenciasUsuarios = {
    correio: auth.correio,
    senhas: deps.senhas,
    webUrl: ambiente.WEB_URL,
    agora: deps.agora,
  };
  await app.register(rotasUsuarios, { deps: usuarios, executar: deps.executar });
  await app.register(rotasCadastros);
  await app.register(rotasConfiguracoes, { cache: criarCacheDeConfiguracoes(deps.agora) });
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
