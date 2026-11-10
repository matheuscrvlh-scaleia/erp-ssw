/**
 * O que as rotas da ingestão usam de fora: transação no contexto da empresa (com o ator da
 * auditoria), empresas para a decisão das rotas públicas, Redis (fila, travas, progresso) e a fila
 * de jobs. Produção monta em `server.ts`; os testes passam falsos.
 */
import {
  type DependenciasDoCiclo,
  type EmpresaParaIngestao,
  type Enfileirador,
  type FilaDeAplicacao,
  type Progressos,
  type Transacional,
  type Travas,
} from "@erp/ingestao/casos-de-uso";
import { type AtorDaIngestao } from "@erp/ingestao/infra";

export interface ServicosDaIngestao {
  executarNaEmpresa(empresaId: string, ator: AtorDaIngestao | null): Transacional;
  /** Empresas com status e integrações ligadas (contexto da Plataforma). */
  empresasParaIngestao(): Promise<EmpresaParaIngestao[]>;
  /**
   * Segredos decifrados da integração `ingestao_publica` ligada, um por empresa: é o segredo que
   * diz qual empresa chama as rotas públicas.
   */
  segredosDaIngestao(): Promise<SegredoDaIngestao[]>;
  fila: FilaDeAplicacao;
  travas: Travas;
  progressos: Progressos;
  enfileirador: Enfileirador;
}

export interface SegredoDaIngestao {
  empresaId: string;
  segredo: string;
}

export function dependenciasDaEmpresa(
  s: ServicosDaIngestao,
  empresaId: string,
  ator: AtorDaIngestao | null,
  agora: () => Date,
): DependenciasDoCiclo {
  return {
    empresaId,
    executar: s.executarNaEmpresa(empresaId, ator),
    fila: s.fila,
    travas: s.travas,
    enfileirador: s.enfileirador,
    agora,
  };
}
