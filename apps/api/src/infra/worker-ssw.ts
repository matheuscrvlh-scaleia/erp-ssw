/**
 * Cliente do HTTP interno do worker-ssw (ADR 0012): pede execuções, consulta o fim delas, lê a
 * situação dos jobs da empresa e repassa as operações manuais da Importação SSW. Só na rede
 * interna, com o token de serviço. Erro de negócio do worker-ssw (409, 400, 404) chega ao operador
 * com a mensagem dele; worker fora do ar, lento ou com resposta fora do contrato vira "tente de
 * novo", e o detalhe vai para o log.
 */
import { ErroDeNegocio } from "@erp/domain/errors";
import { montarCaminho } from "@erp/shared/contract";
import {
  consultaDaExecucao,
  DADOS_DOS_JOBS,
  erroInterno,
  execucaoCriada,
  type JobPedivel,
  type PedidoDeExecucao,
  pedidoDeExecucao,
  PREFIXO_INTERNO,
  type SituacaoDaEmpresa,
  situacaoDaEmpresa,
  type SituacaoDaExecucao,
  situacaoDaExecucao,
} from "@erp/shared/contracts/worker-ssw";
import { type CodigoErro } from "@erp/shared/errors";
import { type z } from "@erp/shared/zod";

import { type FonteDaConfiguracao } from "./platform-config";

/**
 * Operações manuais da tela Admin › Importação SSW (ADR 0012, "Operações manuais"). O corpo é o
 * da tela, já validado pelo contrato dela; a resposta vem no formato que a tela usa.
 */
export const OPERACOES_MANUAIS = {
  retomarCiclo: { metodo: "POST", caminho: "/empresas/:empresaId/ciclos/:chave/retomar" },
  descartarCiclo: { metodo: "POST", caminho: "/empresas/:empresaId/ciclos/:chave/descartar" },
  importarRelatorio: { metodo: "POST", caminho: "/empresas/:empresaId/relatorios" },
  aplicar: { metodo: "POST", caminho: "/empresas/:empresaId/aplicacoes" },
  ftp: { metodo: "GET", caminho: "/empresas/:empresaId/ftp" },
  pausarFtp: { metodo: "PUT", caminho: "/empresas/:empresaId/ftp/ativo" },
  liberarTravaFtp: { metodo: "POST", caminho: "/empresas/:empresaId/ftp/liberar-trava" },
  importarXml: { metodo: "POST", caminho: "/empresas/:empresaId/xml" },
} as const;
export type OperacaoManual = keyof typeof OPERACOES_MANUAIS;

export interface PedidoDeOperacao {
  /** Parâmetros do caminho além da empresa (ex.: `chave` do ciclo). */
  parametros?: Record<string, string>;
  corpo?: unknown;
}

export interface ClienteWorkerSsw {
  /** Id da execução; `null` = `deduplicar` e o job já está na fila ou rodando (409). */
  pedirExecucao(empresaId: string, pedido: PedidoDeExecucao): Promise<string | null>;
  /** Espera até `aguardarMs` (máx. 60 s) a execução terminar; devolve o estado em que ficou. */
  consultarExecucao(
    job: JobPedivel,
    execucaoId: string,
    aguardarMs: number,
  ): Promise<SituacaoDaExecucao>;
  situacao(empresaId: string): Promise<SituacaoDaEmpresa>;
  operacao<T extends z.ZodType>(
    empresaId: string,
    operacao: OperacaoManual,
    saida: T,
    pedido?: PedidoDeOperacao,
  ): Promise<z.output<T>>;
}

interface ConfigWorkerSsw {
  url: string;
  token: string;
  buscar: typeof fetch;
  /** Falha de comunicação (o operador recebe só a mensagem amigável). */
  aoFalhar: (erro: unknown, operacao: string) => void;
}

/** Tempo de resposta do worker-ssw, além da espera pedida na consulta. */
const TIMEOUT_DO_WORKER_SSW_MS = 5_000;
/**
 * Operação manual que grava (importar até 64 MB, aplicar um bloco, descartar): abaixo dos 60 s
 * que a borda espera pela resposta da API.
 */
const TIMEOUT_DA_OPERACAO_QUE_GRAVA_MS = 55_000;
const SO_LEITURA_OU_RAPIDA: ReadonlySet<OperacaoManual> = new Set([
  "ftp",
  "pausarFtp",
  "liberarTravaFtp",
]);

export const MENSAGEM_WORKER_SSW_NAO_CONFIGURADO =
  "Integração com o worker do SSW não configurada. Configure em Plataforma › Configurações › Integrações.";
const MENSAGEM_WORKER_SSW_FORA =
  "O worker do SSW não respondeu. Tente de novo em instantes; se continuar, fale com o suporte.";

/** Ações pedem o worker-ssw; sem endereço e token (Plataforma › Integrações), 503 com o aviso. */
export function exigirWorkerSsw(cliente: ClienteWorkerSsw | null): ClienteWorkerSsw {
  if (cliente === null)
    throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_NAO_CONFIGURADO);
  return cliente;
}

/** Erros do worker-ssw que são do operador (a mensagem já fala com ele). */
const CODIGOS_REPASSADOS: ReadonlySet<CodigoErro> = new Set([
  "ENTRADA_INVALIDA",
  "NAO_ENCONTRADO",
  "CONFLITO",
]);

/** Erro de negócio do corpo de uma resposta 4xx; `null` = não é (vira "não respondeu"). */
async function erroDeNegocioDa(resposta: Response): Promise<ErroDeNegocio | null> {
  const lido = erroInterno.safeParse(await resposta.json().catch(() => null));
  if (!lido.success) return null;
  const { codigo, mensagem } = lido.data.erro;
  const repassado = [...CODIGOS_REPASSADOS].find((c) => c === codigo);
  return repassado ? new ErroDeNegocio(repassado, mensagem) : null;
}

function criarClienteWorkerSsw(config: ConfigWorkerSsw): ClienteWorkerSsw {
  const base = `${config.url.replace(/\/+$/, "")}${PREFIXO_INTERNO}`;

  async function chamar<T extends z.ZodType>(
    operacao: string,
    metodo: string,
    caminho: string,
    saida: T,
    opcoes: { corpo?: unknown; timeoutMs: number; aceitar409?: boolean },
  ): Promise<z.output<T> | null> {
    let repassar: ErroDeNegocio | null = null;
    try {
      const comCorpo = opcoes.corpo !== undefined;
      const resposta = await config.buscar(`${base}${caminho}`, {
        method: metodo,
        headers: {
          authorization: `Bearer ${config.token}`,
          ...(comCorpo ? { "content-type": "application/json" } : {}),
        },
        ...(comCorpo ? { body: JSON.stringify(opcoes.corpo) } : {}),
        signal: AbortSignal.timeout(opcoes.timeoutMs),
      });
      if (resposta.status === 409 && opcoes.aceitar409) return null;
      if (!resposta.ok) {
        repassar = resposta.status < 500 ? await erroDeNegocioDa(resposta) : null;
        throw new Error(`HTTP ${resposta.status}`);
      }
      return saida.parse(await resposta.json());
    } catch (erro) {
      if (repassar) throw repassar;
      config.aoFalhar(erro, operacao);
      throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_FORA);
    }
  }

  async function obrigatorio<T>(resposta: Promise<T | null>): Promise<T> {
    const r = await resposta;
    if (r === null) throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_FORA);
    return r;
  }

  return {
    async pedirExecucao(empresaId, pedido) {
      const valido = pedidoDeExecucao.parse(pedido);
      DADOS_DOS_JOBS[valido.job].parse(valido.dados ?? {});
      const criada = await chamar(
        `pedir ${pedido.job}`,
        "POST",
        montarCaminho("/empresas/:empresaId/execucoes", { empresaId }),
        execucaoCriada,
        { corpo: valido, timeoutMs: TIMEOUT_DO_WORKER_SSW_MS, aceitar409: true },
      );
      return criada?.execucaoId ?? null;
    },

    consultarExecucao(job, execucaoId, aguardarMs) {
      const { aguardarMs: espera } = consultaDaExecucao.parse({ aguardarMs });
      const caminho = montarCaminho("/execucoes/:job/:execucaoId", { job, execucaoId });
      return obrigatorio(
        chamar(`consultar ${job}`, "GET", `${caminho}?aguardarMs=${espera}`, situacaoDaExecucao, {
          timeoutMs: espera + TIMEOUT_DO_WORKER_SSW_MS,
        }),
      );
    },

    situacao(empresaId) {
      return obrigatorio(
        chamar(
          "situação",
          "GET",
          montarCaminho("/empresas/:empresaId/situacao", { empresaId }),
          situacaoDaEmpresa,
          { timeoutMs: TIMEOUT_DO_WORKER_SSW_MS },
        ),
      );
    },

    operacao(empresaId, operacao, saida, pedido = {}) {
      const { metodo, caminho } = OPERACOES_MANUAIS[operacao];
      return obrigatorio(
        chamar(
          operacao,
          metodo,
          montarCaminho(caminho, { ...pedido.parametros, empresaId }),
          saida,
          {
            corpo: pedido.corpo,
            timeoutMs: SO_LEITURA_OU_RAPIDA.has(operacao)
              ? TIMEOUT_DO_WORKER_SSW_MS
              : TIMEOUT_DA_OPERACAO_QUE_GRAVA_MS,
          },
        ),
      );
    },
  };
}

/**
 * Cliente com o endereço e o token da tela Plataforma › Integrações, lidos a cada uso (com o cache
 * da fonte). Sem configuração, toda chamada responde 503 com o aviso, como `exigirWorkerSsw(null)`;
 * as leituras que toleram o worker fora (situação, FTP) seguem sem ele.
 */
export function criarClienteWorkerSswDaPlataforma(
  fonte: FonteDaConfiguracao,
  base: Omit<ConfigWorkerSsw, "url" | "token">,
): ClienteWorkerSsw {
  let atual: { url: string; token: string; cliente: ClienteWorkerSsw } | null = null;
  const cliente = async () => {
    const { workerSsw } = await fonte.obter();
    if (!workerSsw) throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_NAO_CONFIGURADO);
    if (atual?.url !== workerSsw.url || atual.token !== workerSsw.token) {
      atual = { ...workerSsw, cliente: criarClienteWorkerSsw({ ...base, ...workerSsw }) };
    }
    return atual.cliente;
  };
  return {
    pedirExecucao: async (empresaId, pedido) => (await cliente()).pedirExecucao(empresaId, pedido),
    consultarExecucao: async (job, execucaoId, aguardarMs) =>
      (await cliente()).consultarExecucao(job, execucaoId, aguardarMs),
    situacao: async (empresaId) => (await cliente()).situacao(empresaId),
    operacao: async (empresaId, operacao, saida, pedido) =>
      (await cliente()).operacao(empresaId, operacao, saida, pedido),
  };
}
