import { ErroDeNegocio } from "@erp/dominio/erros";
import {
  type Execucao,
  type PedidoDeExecucao,
  type SituacaoDoWorkerSsw,
} from "@erp/shared/contratos/worker-ssw";

import { type ClienteWorkerSsw } from "../infra/worker-ssw";

/** worker-ssw falso: guarda os pedidos e responde o que o teste mandar. */
export class WorkerSswFalso implements ClienteWorkerSsw {
  pedidos: (PedidoDeExecucao & { empresaId: string })[] = [];
  consultas: { job: string; execucaoId: string; aguardarMs: number }[] = [];
  /** Como a execução está quando a API consulta (padrão: ainda na fila). */
  execucao: Execucao = { estado: "na_fila" };
  situacaoDaEmpresa: SituacaoDoWorkerSsw = { jobs: [] };
  /** Chaves `deduplicar` já na fila (o pedido repetido volta 409). */
  naFila = new Set<string>();
  fora = false;
  /** Simula o worker-ssw rodando logo que o pedido chega. */
  aoPedir: (pedido: PedidoDeExecucao) => void = () => undefined;

  private conferir() {
    if (this.fora) throw new ErroDeNegocio("INDISPONIVEL", "O worker do SSW não respondeu.");
  }

  pedirExecucao(empresaId: string, pedido: PedidoDeExecucao) {
    this.conferir();
    if (pedido.deduplicar && this.naFila.has(pedido.deduplicar)) return Promise.resolve(null);
    this.pedidos.push({ ...pedido, empresaId });
    this.aoPedir(pedido);
    return Promise.resolve(String(this.pedidos.length));
  }

  consultarExecucao(job: string, execucaoId: string, aguardarMs: number) {
    this.conferir();
    this.consultas.push({ job, execucaoId, aguardarMs });
    return Promise.resolve(this.execucao);
  }

  situacao() {
    this.conferir();
    return Promise.resolve(this.situacaoDaEmpresa);
  }
}
