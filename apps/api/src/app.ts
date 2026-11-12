import {
  type ChavesDeSegredo,
  cifrarSegredo,
  decifrarSegredo,
  derivarSegredo,
} from "@erp/db/segredos";
import { ErroDeNegocio } from "@erp/dominio/erros";
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { type Redis } from "ioredis";

import { type Ambiente } from "./config/env";
import { registrarTratadorDeErros } from "./http/tratador-erros";
import type { Armazenamento } from "./infra/armazenamento";
import {
  criarFonteDaConfiguracao,
  type FonteDaConfiguracao,
} from "./infra/configuracao-da-plataforma";
import {
  type Correio,
  criarCorreioDaPlataforma,
  criarCorreioDeDesenvolvimento,
} from "./infra/correio";
import type { FilaDeJobs } from "./infra/fila";
import { type ProvedorGoogle } from "./infra/google";
import { type LimitadorDeFalhas } from "./infra/limitador";
import { opcoesDeLog } from "./infra/log";
import { type ServicoDeSenhas } from "./infra/senhas";
import { type EmissorDeTokens } from "./infra/tokens";
import { type ClienteWorkerSsw, criarClienteWorkerSswDaPlataforma } from "./infra/worker-ssw";
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
import { rotasPainelPlataforma } from "./modulos/painel-plataforma/rotas";
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
  /**
   * Ausente = e-mail pelo Resend com a configuração de Plataforma › Integrações (sem ela, o log em
   * desenvolvimento e erro em produção). Os testes passam um falso.
   */
  correio?: Correio;
  google: ProvedorGoogle | null;
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
  // O env exige um dos dois (SEGREDOS_CHAVES ou COOKIE_SEGREDO).
  const segredoDoCookie =
    ambiente.COOKIE_SEGREDO ?? (chaves ? derivarSegredo(chaves, "cookie") : "");
  await registrarSeguranca(app, {
    ambiente,
    redis: deps.redis,
    comDocumentacao,
    segredoDoCookie,
  });
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
  await app.register(rotasAuth, {
    deps: auth,
    google: deps.google,
    googleRedirectUri: ambiente.GOOGLE_REDIRECT_URI ?? null,
  });
  await app.register(rotasCalendario, { agora: deps.agora });
  await app.register(rotasIngestao, { deps: { workerSsw } });
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

  await app.register(rotasIngestaoSsw, {
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
    configuracao,
    correio,
  });
  await app.register(rotasPainelPlataforma, {
    executar: deps.executar,
    workerSsw,
    agora: deps.agora,
  });

  return app;
}
