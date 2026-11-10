import { type ContextoBanco } from "@erp/db";
import { z } from "@erp/shared/zod";
import { UnrecoverableError } from "bullmq";
import { type Logger } from "pino";

import { type DefinicaoDeJob, type ExecutorDoWorker } from "./jobs/registro";

const dadosDeEmpresa = z.object({ empresaId: z.uuid() });

export interface DependenciasDoProcessador {
  jobs: readonly DefinicaoDeJob[];
  executar: ExecutorDoWorker;
  log: Logger;
  agora: () => Date;
}

/** Contexto do banco do job: igual ao da API (RLS pela empresa) ou o da Plataforma. */
function contextoDoJob(job: DefinicaoDeJob, dados: unknown): ContextoBanco {
  if (job.escopo === "plataforma") return { empresaId: null, usuarioId: null, plataforma: true };
  return { empresaId: dadosDeEmpresa.parse(dados).empresaId, usuarioId: null, plataforma: false };
}

/**
 * Função entregue ao Worker do BullMQ: acha a definição pelo nome, valida os dados e roda no
 * contexto certo. Job desconhecido ou dado inválido não adianta repetir (UnrecoverableError).
 */
export function criarProcessador(deps: DependenciasDoProcessador) {
  const porNome = new Map(deps.jobs.map((j) => [j.nome, j]));
  return async (job: { id?: string | undefined; name: string; data: unknown }) => {
    const definicao = porNome.get(job.name);
    if (!definicao) throw new UnrecoverableError(`Job desconhecido: ${job.name}`);
    let dados: unknown;
    let contexto: ContextoBanco;
    try {
      dados = definicao.dados.parse(job.data);
      contexto = contextoDoJob(definicao, job.data);
    } catch (erro) {
      throw new UnrecoverableError(`Dados inválidos para ${job.name}: ${String(erro)}`);
    }
    const log = deps.log.child({ job: job.name, jobId: job.id, empresaId: contexto.empresaId });
    return definicao.processar(
      {
        executar: (fn) => deps.executar(contexto, fn),
        empresaId: contexto.empresaId,
        log,
        agora: deps.agora,
      },
      dados,
    );
  };
}
