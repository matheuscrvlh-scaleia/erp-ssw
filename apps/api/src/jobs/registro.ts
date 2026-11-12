/**
 * Jobs do ERP que rodam dentro do processo da API (ADR 0012), com BullMQ no Redis do ERP. Os jobs
 * que falam com o SSW são do worker-ssw.
 */
import { type ContextoBanco } from "@erp/db";
import { type CteGravado, type RepositorioCteNucleo } from "@erp/dominio/nucleo";
import { type z } from "@erp/shared/zod";
import { type FastifyBaseLogger } from "fastify";

import { type RepositorioAgendamentos } from "../models/agendamentos/agendamentos.repository";
import { type RepositorioManutencao } from "../models/manutencao/manutencao.service";
import { type RepositorioPrazosDoJob } from "../models/prazos/recalculo-de-prazos.service";
import { type RepositorioRecalculo } from "../models/recalculo/recalculo.service";
import { type RepositorioSegredos } from "../models/segredos/segredos.service";

/** Repositórios dos jobs presos a uma transação com contexto (mesmo padrão da API). */
export interface RepositoriosDosJobs {
  agendamentos: RepositorioAgendamentos;
  manutencao: RepositorioManutencao;
  /** Gravação do CT-e pelo núcleo, na empresa do contexto (só os jobs por empresa usam). */
  cteNucleo: RepositorioCteNucleo<CteGravado>;
  prazos: RepositorioPrazosDoJob;
  recalculo: RepositorioRecalculo;
  /** Segredos cifrados das integrações (recifrar com a chave atual; contexto de Plataforma). */
  segredos: RepositorioSegredos;
}

export type ExecutorDosJobs = <T>(
  contexto: ContextoBanco,
  fn: (repositorios: RepositoriosDosJobs) => Promise<T>,
) => Promise<T>;

export type NomeDaFila = "manutencao" | "prazos" | "recalculo";

interface DefinicaoDeFila {
  nome: NomeDaFila;
  /** Jobs ao mesmo tempo neste processo. */
  concorrencia: number;
}

/**
 * Filas e a concorrência de cada uma, por réplica da API. Fila separada por natureza de trabalho:
 * um recálculo longo não atrasa a manutenção.
 */
export const FILAS: readonly DefinicaoDeFila[] = [
  { nome: "manutencao", concorrencia: 1 },
  // Recálculo de previsão pelos prazos configurados: um por vez (cada um varre a empresa).
  { nome: "prazos", concorrencia: 1 },
  // Recálculos em lote pedidos pelo Admin (ex.: classificação de código de ocorrência).
  { nome: "recalculo", concorrencia: 1 },
];

/** Prefixo das chaves do BullMQ no Redis do ERP. */
export const PREFIXO_DAS_FILAS = "erp";

/** 5 tentativas com espera exponencial de 30 s; histórico limitado no Redis. */
export const OPCOES_PADRAO_DO_JOB = {
  attempts: 5,
  backoff: { type: "exponential", delay: 30_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;

/** `plataforma`: um job para o sistema todo. `empresa`: um por empresa ativa, no contexto dela. */
export type Escopo = "plataforma" | "empresa";

export interface ContextoDoJob {
  /** Já no contexto do job: empresa (escopo empresa) ou Plataforma (escopo plataforma). */
  executar: <T>(fn: (repositorios: RepositoriosDosJobs) => Promise<T>) => Promise<T>;
  empresaId: string | null;
  log: FastifyBaseLogger;
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
  processar(contexto: ContextoDoJob, dados: D): Promise<unknown>;
}

export function definirJob<D>(definicao: DefinicaoDeJob<D>): DefinicaoDeJob<D> {
  return definicao;
}
