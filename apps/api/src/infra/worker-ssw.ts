/**
 * Cliente do HTTP interno do worker-ssw (ADR 0012): pede execuções, consulta o fim delas e lê a
 * situação dos jobs da empresa. Só na rede interna, com o token de serviço. Worker fora do ar,
 * lento ou com resposta fora do contrato vira "tente de novo" para o operador; o detalhe vai
 * para o log.
 */
import { ErroDeNegocio } from "@erp/dominio/erros";
import { montarCaminho } from "@erp/shared/contrato";
import {
  contratoWorkerSsw as c,
  type Execucao,
  type JobPedivel,
  type PedidoDeExecucao,
  type SituacaoDoWorkerSsw,
} from "@erp/shared/contratos/worker-ssw";
import { type z } from "@erp/shared/zod";

export interface ClienteWorkerSsw {
  /** Id da execução; `null` = a chave `deduplicar` já está na fila ou rodando (409). */
  pedirExecucao(empresaId: string, pedido: PedidoDeExecucao): Promise<string | null>;
  /** Espera até `aguardarMs` (máx. 60 s) a execução terminar; devolve o estado em que ficou. */
  consultarExecucao(job: JobPedivel, execucaoId: string, aguardarMs: number): Promise<Execucao>;
  situacao(empresaId: string): Promise<SituacaoDoWorkerSsw>;
}

export interface ConfigWorkerSsw {
  url: string;
  token: string;
  buscar: typeof fetch;
  /** Falha de comunicação (o operador recebe só a mensagem amigável). */
  aoFalhar: (erro: unknown, operacao: string) => void;
}

/** Tempo de resposta do worker-ssw, além da espera pedida na consulta. */
export const TIMEOUT_DO_WORKER_SSW_MS = 5_000;

export const MENSAGEM_WORKER_SSW_NAO_CONFIGURADO =
  "Integração com o worker do SSW não configurada.";
const MENSAGEM_WORKER_SSW_FORA =
  "O worker do SSW não respondeu. Tente de novo em instantes; se continuar, fale com o suporte.";

/** Ações pedem o worker-ssw; sem `WORKER_SSW_URL`/`WORKER_SSW_TOKEN`, 503 com o aviso. */
export function exigirWorkerSsw(cliente: ClienteWorkerSsw | null): ClienteWorkerSsw {
  if (cliente === null)
    throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_NAO_CONFIGURADO);
  return cliente;
}

export function criarClienteWorkerSsw(config: ConfigWorkerSsw): ClienteWorkerSsw {
  const base = config.url.replace(/\/+$/, "");

  async function chamar<T extends z.ZodType>(
    operacao: string,
    caminho: string,
    saida: T,
    opcoes: { corpo?: unknown; esperaMs?: number; aceitar409?: boolean } = {},
  ): Promise<z.output<T> | null> {
    try {
      const resposta = await config.buscar(`${base}${caminho}`, {
        method: opcoes.corpo === undefined ? "GET" : "POST",
        headers: {
          authorization: `Bearer ${config.token}`,
          ...(opcoes.corpo === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(opcoes.corpo === undefined ? {} : { body: JSON.stringify(opcoes.corpo) }),
        signal: AbortSignal.timeout((opcoes.esperaMs ?? 0) + TIMEOUT_DO_WORKER_SSW_MS),
      });
      if (resposta.status === 409 && opcoes.aceitar409) return null;
      if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
      return saida.parse(await resposta.json());
    } catch (erro) {
      config.aoFalhar(erro, operacao);
      throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_FORA);
    }
  }

  return {
    async pedirExecucao(empresaId, pedido) {
      const criada = await chamar(
        `pedir ${pedido.job}`,
        montarCaminho(c.pedirExecucao.caminho, { empresaId }),
        c.pedirExecucao.saida,
        { corpo: c.pedirExecucao.entrada.parse(pedido), aceitar409: true },
      );
      return criada?.execucaoId ?? null;
    },

    async consultarExecucao(job, execucaoId, aguardarMs) {
      const { aguardarMs: espera } = c.consultarExecucao.entrada.parse({ aguardarMs });
      const caminho = montarCaminho(c.consultarExecucao.caminho, { job, execucaoId });
      const execucao = await chamar(
        `consultar ${job}`,
        `${caminho}?aguardarMs=${espera}`,
        c.consultarExecucao.saida,
        { esperaMs: espera },
      );
      if (execucao === null) throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_FORA);
      return execucao;
    },

    async situacao(empresaId) {
      const situacao = await chamar(
        "situação",
        montarCaminho(c.situacao.caminho, { empresaId }),
        c.situacao.saida,
      );
      if (situacao === null) throw new ErroDeNegocio("INDISPONIVEL", MENSAGEM_WORKER_SSW_FORA);
      return situacao;
    },
  };
}
