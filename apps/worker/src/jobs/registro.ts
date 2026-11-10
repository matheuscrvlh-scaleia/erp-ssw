import { type ContextoBanco } from "@erp/db";
import { type z } from "@erp/shared/zod";
import { type Logger } from "pino";

import { type RepositorioAgendamentos } from "../agendamentos/agendamentos";
import { type RepositorioManutencao } from "./manutencao/job";

/** Repositórios dos jobs presos a uma transação com contexto (mesmo padrão da API). */
export interface RepositoriosDoWorker {
  agendamentos: RepositorioAgendamentos;
  manutencao: RepositorioManutencao;
}

export type ExecutorDoWorker = <T>(
  contexto: ContextoBanco,
  fn: (repositorios: RepositoriosDoWorker) => Promise<T>,
) => Promise<T>;

/**
 * Filas e a concorrência de cada uma. Fila separada por natureza de trabalho: ingestão pesada não
 * pode atrasar manutenção, e vice-versa.
 */
export const FILAS = [{ nome: "manutencao", concorrencia: 1 }] as const;
export type NomeDaFila = (typeof FILAS)[number]["nome"];

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
  processar(contexto: ContextoDoJob, dados: D): Promise<void>;
}

export function definirJob<D>(definicao: DefinicaoDeJob<D>): DefinicaoDeJob<D> {
  return definicao;
}

/** Política padrão: 5 tentativas com espera exponencial; histórico limitado no Redis. */
export const OPCOES_PADRAO_DO_JOB = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;
