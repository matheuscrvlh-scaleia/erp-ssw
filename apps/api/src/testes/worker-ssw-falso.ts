import { ErroDeNegocio } from "@erp/dominio/erros";
import {
  type JobPedivel,
  type PedidoDeExecucao,
  type SituacaoDaEmpresa,
  type SituacaoDaExecucao,
} from "@erp/shared/contratos/worker-ssw";
import { type z } from "@erp/shared/zod";

import {
  type ClienteWorkerSsw,
  type OperacaoManual,
  type PedidoDeOperacao,
} from "../infra/worker-ssw";

/** worker-ssw falso: guarda os pedidos e responde o que o teste mandar. */
export class WorkerSswFalso implements ClienteWorkerSsw {
  pedidos: (PedidoDeExecucao & { empresaId: string })[] = [];
  consultas: { job: string; execucaoId: string; aguardarMs: number }[] = [];
  operacoes: (PedidoDeOperacao & { empresaId: string; operacao: OperacaoManual })[] = [];
  /** Como a execução está quando a API consulta (padrão: ainda na fila). */
  execucao: SituacaoDaExecucao = { estado: "na_fila" };
  situacaoDaEmpresa: SituacaoDaEmpresa = { jobs: [] };
  /** Resposta de cada operação manual (o teste põe a que vai usar). */
  respostas: Partial<Record<OperacaoManual, unknown>> = {};
  /** Jobs já na fila: o pedido repetido com `deduplicar` volta 409. */
  naFila = new Set<JobPedivel>();
  fora = false;
  /** Simula o worker-ssw rodando logo que o pedido chega. */
  aoPedir: (pedido: PedidoDeExecucao) => void = () => undefined;
  aoOperar: (operacao: OperacaoManual) => void = () => undefined;

  private conferir() {
    if (this.fora) throw new ErroDeNegocio("INDISPONIVEL", "O worker do SSW não respondeu.");
  }

  pedirExecucao(empresaId: string, pedido: PedidoDeExecucao) {
    this.conferir();
    if (pedido.deduplicar && this.naFila.has(pedido.job)) return Promise.resolve(null);
    this.pedidos.push({ ...pedido, empresaId });
    this.aoPedir(pedido);
    return Promise.resolve(String(this.pedidos.length));
  }

  consultarExecucao(job: JobPedivel, execucaoId: string, aguardarMs: number) {
    this.conferir();
    this.consultas.push({ job, execucaoId, aguardarMs });
    return Promise.resolve(this.execucao);
  }

  situacao() {
    this.conferir();
    return Promise.resolve(this.situacaoDaEmpresa);
  }

  operacao<T extends z.ZodType>(
    empresaId: string,
    operacao: OperacaoManual,
    saida: T,
    pedido: PedidoDeOperacao = {},
  ): Promise<z.output<T>> {
    this.conferir();
    this.operacoes.push({ ...pedido, empresaId, operacao });
    this.aoOperar(operacao);
    return Promise.resolve(saida.parse(this.respostas[operacao]));
  }
}
