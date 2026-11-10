import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { type Redis } from "ioredis";

import { type Ambiente } from "./config/env";
import { registrarTratadorDeErros } from "./http/tratador-erros";
import { type Correio, criarCorreioDeDesenvolvimento } from "./infra/correio";
import { type ProvedorGoogle } from "./infra/google";
import { type LimitadorDeFalhas } from "./infra/limitador";
import { opcoesDeLog } from "./infra/log";
import { type ServicoDeSenhas } from "./infra/senhas";
import { type FilaDeRecalculo } from "./infra/fila";
import { type EmissorDeTokens } from "./infra/tokens";
import { type DependenciasAuth } from "./modulos/auth/casos-de-uso";
import { rotasAuth } from "./modulos/auth/rotas";
import { rotasCalendario } from "./modulos/calendario/rotas";
import { rotasCodigosOcorrencia } from "./modulos/codigos-ocorrencia/rotas";
import { rotasColetas } from "./modulos/coletas/rotas";
import { rotasComprovantes } from "./modulos/comprovantes/rotas";
import { rotasHistorico } from "./modulos/historico/rotas";
import { rotasOcorrencias } from "./modulos/ocorrencias/rotas";
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
  /** Recálculos em lote no worker; sem Redis (desenvolvimento/teste), tudo vai na transação. */
  filaDeRecalculo?: FilaDeRecalculo;
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
  await app.register(rotasOcorrencias, { agora: deps.agora });
  await app.register(rotasComprovantes);
  await app.register(rotasColetas, { agora: deps.agora });
  await app.register(rotasHistorico, { agora: deps.agora });
  await app.register(rotasCodigosOcorrencia, {
    agora: deps.agora,
    fila: deps.filaDeRecalculo ?? null,
  });

  return app;
}
