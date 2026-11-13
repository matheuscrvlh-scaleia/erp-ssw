import { type ChavesDeSegredo, cifrarSegredo, decifrarSegredo } from "@erp/db/secrets";
import { ErroDeNegocio } from "@erp/domain/errors";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { type Redis } from "ioredis";

import { type Ambiente } from "./config";
import { controladorAhgora } from "./controllers/ahgora.controller";
import { controladorAuth } from "./controllers/auth.controller";
import { controladorCalendario } from "./controllers/calendar.controller";
import { controladorCtrc } from "./controllers/ctrc.controller";
import { controladorPrazos } from "./controllers/deadlines.controller";
import { controladorBonificacaoEntrega } from "./controllers/delivery-bonus.controller";
import { controladorComprovantes } from "./controllers/delivery-proofs.controller";
import { controladorFiltros } from "./controllers/filters.controller";
import { controladorHistorico } from "./controllers/history.controller";
import { controladorIngestao } from "./controllers/ingestion.controller";
import { controladorListagem } from "./controllers/listing.controller";
import { controladorLogs } from "./controllers/logs.controller";
import { controladorRomaneio } from "./controllers/manifest.controller";
import { controladorCadastros } from "./controllers/master-data.controller";
import { registrarTratadorDeErros } from "./controllers/middleware/error-handler";
import { registrarSeguranca } from "./controllers/middleware/security";
import { pluginSessao } from "./controllers/middleware/session";
import {
  registrarDocumentacao,
  registrarMetricas,
  registrarSaude,
} from "./controllers/observability.controller";
import { controladorCodigosOcorrencia } from "./controllers/occurrence-codes.controller";
import { controladorOcorrencias } from "./controllers/occurrences.controller";
import { controladorPrazoParceiro } from "./controllers/partner-deadline.controller";
import { controladorPerformance } from "./controllers/performance.controller";
import { controladorColetas } from "./controllers/pickups.controller";
import { controladorPlataforma } from "./controllers/platform.controller";
import { controladorPainelPlataforma } from "./controllers/platform-dashboard.controller";
import { controladorRanking } from "./controllers/ranking.controller";
import { controladorConfiguracoes } from "./controllers/settings.controller";
import { controladorIngestaoSsw } from "./controllers/ssw-ingestion.controller";
import { controladorUsuarios } from "./controllers/users.controller";
import { type LimitadorDeFalhas } from "./infra/limiter";
import { opcoesDeLog } from "./infra/log";
import {
  type Correio,
  criarCorreioDaPlataforma,
  criarCorreioDeDesenvolvimento,
} from "./infra/mail";
import { type ServicoDeSenhas } from "./infra/passwords";
import { criarFonteDaConfiguracao, type FonteDaConfiguracao } from "./infra/platform-config";
import type { FilaDeJobs } from "./infra/queue";
import type { Armazenamento } from "./infra/storage";
import { type EmissorDeTokens } from "./infra/tokens";
import { type ClienteWorkerSsw, criarClienteWorkerSswDaPlataforma } from "./infra/worker-ssw";
import { type DependenciasAhgora } from "./models/ahgora/ahgora.service";
import { type DependenciasAuth } from "./models/auth/auth.service";
import { type ExecutorComContexto } from "./models/repositories";
import { type CacheDeConfiguracoes, criarCacheDeConfiguracoes } from "./models/settings/cache";
import { type DependenciasUsuarios } from "./models/users/users.service";

/** Tudo o que a API usa de fora. Produção monta em `server.ts`; os testes passam falsos. */
interface Dependencias {
  ambiente: Ambiente;
  executar: ExecutorComContexto;
  verificarBanco: () => Promise<void>;
  redis: Redis | null;
  tokens: EmissorDeTokens;
  senhas: ServicoDeSenhas;
  limitador: LimitadorDeFalhas;
  /**
   * Ausente = e-mail pelo Resend com a configuração de Plataforma › Integrações (sem ela, o log em
   * desenvolvimento e erro em produção). Os testes passam um falso.
   */
  correio?: Correio;
  /**
   * HTTP interno do worker-ssw (ADR 0012). Ausente = endereço e token de Plataforma › Integrações;
   * nulo (testes) = não configurado: as ações de ingestão respondem 503 e as leituras continuam.
   */
  workerSsw?: ClienteWorkerSsw | null;
  /** Ausente = lida do banco (`plataforma_integracoes`) com cache curto. */
  configuracaoDaPlataforma?: FonteDaConfiguracao;
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
  const chaves = deps.chavesDeSegredo;
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

  const configuracao =
    deps.configuracaoDaPlataforma ??
    criarFonteDaConfiguracao({
      ler: () =>
        deps.executar({ empresaId: null, usuarioId: null, plataforma: false }, ({ plataforma }) =>
          plataforma.integracoesDaPlataforma(),
        ),
      chaves,
      agora: deps.agora,
      aoFalhar: (erro, tipo) => {
        app.log.error({ err: erro, tipo }, "segredo da Plataforma não decifra com SEGREDOS_CHAVES");
      },
    });
  const correio =
    deps.correio ??
    criarCorreioDaPlataforma(
      configuracao,
      ambiente.NODE_ENV === "production" ? null : criarCorreioDeDesenvolvimento(app.log),
    );
  const workerSsw =
    deps.workerSsw === undefined
      ? criarClienteWorkerSswDaPlataforma(configuracao, {
          buscar: fetch,
          aoFalhar: (erro, operacao) => {
            app.log.warn({ err: erro, operacao }, "worker-ssw não respondeu");
          },
        })
      : deps.workerSsw;
  const webUrl = async () => {
    const url = (await configuracao.obter()).dominio ?? ambiente.WEB_URL;
    if (!url) {
      throw new ErroDeNegocio(
        "INDISPONIVEL",
        "O domínio do sistema não está configurado. Configure em Plataforma › Configurações › Integrações.",
      );
    }
    return url;
  };

  const acesso = { executar: deps.executar, agora: deps.agora, urlDoLogo: urlDoLogo(ambiente) };
  await app.register(pluginSessao, { ...acesso, tokens: deps.tokens });

  const auth: DependenciasAuth = {
    ...acesso,
    senhas: deps.senhas,
    tokens: deps.tokens,
    limitador: deps.limitador,
    correio,
    webUrl,
  };
  await app.register(controladorAuth, {
    deps: auth,
  });
  await app.register(controladorCalendario, { agora: deps.agora });
  await app.register(controladorIngestao, { deps: { workerSsw } });
  await app.register(controladorRomaneio, { agora: deps.agora });
  await app.register(controladorPrazoParceiro);
  await app.register(controladorOcorrencias, { agora: deps.agora });
  await app.register(controladorComprovantes);
  await app.register(controladorColetas, { agora: deps.agora });
  await app.register(controladorHistorico, { agora: deps.agora });
  await app.register(controladorCodigosOcorrencia, {
    agora: deps.agora,
    fila: deps.fila,
  });
  await app.register(controladorFiltros);
  await app.register(controladorListagem, { agora: deps.agora });
  await app.register(controladorCtrc, { agora: deps.agora });
  await app.register(controladorPerformance, { agora: deps.agora });
  const ahgora = deps.ahgora ?? { segredos: null, ambiente: {}, http: fetch };
  await app.register(controladorRanking, { agora: deps.agora, executar: deps.executar });
  await app.register(controladorBonificacaoEntrega, { ahgora });
  await app.register(controladorAhgora, { ahgora });

  await app.register(controladorIngestaoSsw, {
    deps: {
      workerSsw,
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
    correio,
    senhas: deps.senhas,
    webUrl,
    agora: deps.agora,
  };
  await app.register(controladorUsuarios, { deps: usuarios, executar: deps.executar });
  await app.register(controladorCadastros);
  await app.register(controladorConfiguracoes, {
    cache: deps.cacheDeConfiguracoes ?? criarCacheDeConfiguracoes(deps.agora),
  });
  await app.register(controladorPrazos, { fila: deps.fila });
  await app.register(controladorLogs, { executar: deps.executar });
  await app.register(controladorPlataforma, {
    executar: deps.executar,
    armazenamento: deps.armazenamento,
    chavesDeSegredo: deps.chavesDeSegredo,
    urlDoLogo: acesso.urlDoLogo,
    agora: deps.agora,
    configuracao,
    correio,
  });
  await app.register(controladorPainelPlataforma, {
    executar: deps.executar,
    workerSsw,
    agora: deps.agora,
  });

  return app;
}
