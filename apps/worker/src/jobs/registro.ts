import { type ContextoBanco } from "@erp/db";
import { filaDoJob, JOBS_DE_INGESTAO, type NomeDoJobDeIngestao } from "@erp/shared/ingestao";
import { type z } from "@erp/shared/zod";
import { type Logger } from "pino";

import { type RepositorioAgendamentos } from "../agendamentos/agendamentos";
import { type RepositorioBi2 } from "../fontes/bi2/job";
import { type RepositorioCteNucleo } from "../fontes/comum/cte-nucleo";
import { type RepositorioIntegracoes } from "../fontes/comum/integracao";
import { type RepositorioWebhook } from "../fontes/webhook/job";
import { type RepositorioManutencao } from "./manutencao/job";
import { type RepositorioSlaArquivos } from "./sla-arquivos/job";

/** Repositórios dos jobs presos a uma transação com contexto (mesmo padrão da API). */
export interface RepositoriosDoWorker {
  agendamentos: RepositorioAgendamentos;
  manutencao: RepositorioManutencao;
  integracoes: RepositorioIntegracoes;
  cteNucleo: RepositorioCteNucleo;
  bi2: RepositorioBi2;
  webhook: RepositorioWebhook;
  slaArquivos: RepositorioSlaArquivos;
}

export type ExecutorDoWorker = <T>(
  contexto: ContextoBanco,
  fn: (repositorios: RepositoriosDoWorker) => Promise<T>,
) => Promise<T>;

export type NomeDaFila = "manutencao" | "agendador" | "projecoes" | ReturnType<typeof filaDoJob>;

export interface DefinicaoDeFila {
  nome: NomeDaFila;
  /** Jobs ao mesmo tempo neste processo. */
  concorrencia: number;
  /** Jobs ao mesmo tempo em todos os processos do worker (`setGlobalConcurrency`). */
  concorrenciaGlobal?: number;
}

/**
 * Uma execução por vez em todos os processos: o BI2 é pesado e o SSW limita (era a lease
 * `bi2_pesado`); o webhook em ordem para duas ocorrências do mesmo CT-e não se cruzarem.
 */
const UMA_POR_VEZ: ReadonlySet<NomeDoJobDeIngestao> = new Set(["bi2_0017", "ssw_webhook"]);

/**
 * Filas e a concorrência de cada uma. Fila separada por natureza de trabalho: ingestão pesada não
 * pode atrasar manutenção, e vice-versa. Cada job de ingestão tem a sua (singleton por empresa).
 */
export const FILAS: readonly DefinicaoDeFila[] = [
  { nome: "manutencao", concorrencia: 1 },
  { nome: "agendador", concorrencia: 1 },
  ...JOBS_DE_INGESTAO.map(({ job }) => ({
    nome: filaDoJob(job),
    concorrencia: 1,
    ...(UMA_POR_VEZ.has(job) ? { concorrenciaGlobal: 1 } : {}),
  })),
  { nome: "projecoes", concorrencia: 2 },
];

/** `plataforma`: um job para o sistema todo. `empresa`: um por empresa ativa, no contexto dela. */
export type Escopo = "plataforma" | "empresa";

export interface ContextoDoJob {
  /** Já no contexto do job: empresa (escopo empresa) ou Plataforma (escopo plataforma). */
  executar: <T>(fn: (repositorios: RepositoriosDoWorker) => Promise<T>) => Promise<T>;
  empresaId: string | null;
  log: Logger;
  agora: () => Date;
}

export interface DefinicaoDeJob<D = unknown> {
  nome: string;
  fila: NomeDaFila;
  escopo: Escopo;
  dados: z.ZodType<D>;
  /** Cron (no fuso da empresa; Plataforma em America/Sao_Paulo). Nulo = só sob demanda. */
  agendamento: string | null;
  // Assinatura de método (não propriedade) de propósito: deixa a lista de jobs com dados
  // diferentes caber em DefinicaoDeJob[]; quem garante o tipo em tempo de execução é o zod.
  // O que devolve vira o resultado do job no BullMQ (a API lê no "testar conexão").
  processar(contexto: ContextoDoJob, dados: D): Promise<unknown>;
}

export function definirJob<D>(definicao: DefinicaoDeJob<D>): DefinicaoDeJob<D> {
  return definicao;
}

export { OPCOES_PADRAO_DO_JOB } from "@erp/shared/ingestao";
