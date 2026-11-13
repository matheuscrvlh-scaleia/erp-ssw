import { type ContextoBanco, type Transacao } from "@erp/db";

import { criarRepositorioAcesso } from "./access/access.repository";
import { type RepositorioAcesso } from "./access/access.service";
import { criarRepositorioAhgora } from "./ahgora/ahgora.repository";
import { type RepositorioAhgora } from "./ahgora/ahgora.service";
import { criarRepositorioAuditoria } from "./audit/audit.repository";
import { type RepositorioAuditoria } from "./audit/audit.service";
import { criarRepositorioAuth } from "./auth/auth.repository";
import { type RepositorioAuth } from "./auth/auth.service";
import { criarRepositorioCalendario } from "./calendar/calendar.repository";
import { type RepositorioCalendario } from "./calendar/calendar.service";
import { criarRepositorioCtrc } from "./ctrc/ctrc.repository";
import { type RepositorioCtrc } from "./ctrc/ctrc.service";
import { criarRepositorioPrazos } from "./deadlines/deadlines.repository";
import { type RepositorioPrazos } from "./deadlines/deadlines.service";
import { criarRepositorioBonificacaoEntrega } from "./delivery-bonus/delivery-bonus.repository";
import { type RepositorioBonificacaoEntrega } from "./delivery-bonus/delivery-bonus.service";
import { criarRepositorioComprovantes } from "./delivery-proofs/delivery-proofs.repository";
import { type RepositorioComprovantes } from "./delivery-proofs/delivery-proofs.service";
import { criarRepositorioFiltros } from "./filters/filters.repository";
import { type RepositorioFiltros } from "./filters/filters.service";
import { criarRepositorioHistorico } from "./history/history.repository";
import { type RepositorioHistorico } from "./history/history.service";
import { criarRepositorioIngestao } from "./ingestion/ingestion.repository";
import { type RepositorioIngestao } from "./ingestion/ingestion.service";
import { criarRepositorioListagem } from "./listing/listing.repository";
import { type RepositorioListagem } from "./listing/listing.service";
import { criarRepositorioLogs } from "./logs/logs.repository";
import { type RepositorioLogs } from "./logs/logs.service";
import { criarRepositorioRomaneio } from "./manifest/manifest.repository";
import { type RepositorioRomaneio } from "./manifest/manifest.service";
import { criarRepositorioCadastros } from "./master-data/master-data.repository";
import { type RepositorioCadastros } from "./master-data/master-data.service";
import { criarRepositorioCodigosOcorrencia } from "./occurrence-codes/occurrence-codes.repository";
import { type RepositorioCodigosOcorrencia } from "./occurrence-codes/occurrence-codes.service";
import { criarRepositorioOcorrencias } from "./occurrences/occurrences.repository";
import { type RepositorioOcorrencias } from "./occurrences/occurrences.service";
import { criarRepositorioPrazoParceiro } from "./partner-deadline/partner-deadline.repository";
import { type RepositorioPrazoParceiro } from "./partner-deadline/partner-deadline.service";
import { criarRepositorioPerformance } from "./performance/performance.repository";
import { type RepositorioPerformance } from "./performance/performance.service";
import { criarRepositorioColetas } from "./pickups/pickups.repository";
import { type RepositorioColetas } from "./pickups/pickups.service";
import { criarRepositorioPlataforma } from "./platform/platform.repository";
import { type RepositorioPlataforma } from "./platform/platform.service";
import { criarRepositorioRanking } from "./ranking/ranking.repository";
import { type RepositorioRanking } from "./ranking/ranking.service";
import { type CacheDeConfiguracoes } from "./settings/cache";
import { carregarConfiguracoesDoBanco, criarLeitorDeConfiguracoes } from "./settings/reader";
import { criarRepositorioConfiguracoes } from "./settings/settings.repository";
import { type RepositorioConfiguracoes } from "./settings/settings.service";
import { criarRepositorioIngestaoSsw } from "./ssw-ingestion/ssw-ingestion.repository";
import { type RepositorioIngestaoSsw } from "./ssw-ingestion/ssw-ingestion.service";
import { criarRepositorioUsuarios } from "./users/users.repository";
import { type RepositorioUsuarios } from "./users/users.service";

/**
 * Repositórios de todos os models, presos a uma transação com contexto. Model novo entra aqui
 * (interface no `<recurso>.service.ts`, implementação no `<recurso>.repository.ts`).
 */
export interface Repositorios {
  acesso: RepositorioAcesso;
  ahgora: RepositorioAhgora;
  auditoria: RepositorioAuditoria;
  auth: RepositorioAuth;
  bonificacaoEntrega: RepositorioBonificacaoEntrega;
  calendario: RepositorioCalendario;
  prazoParceiro: RepositorioPrazoParceiro;
  romaneio: RepositorioRomaneio;
  ingestao: RepositorioIngestao;
  ingestaoSsw: RepositorioIngestaoSsw;
  codigosOcorrencia: RepositorioCodigosOcorrencia;
  coletas: RepositorioColetas;
  comprovantes: RepositorioComprovantes;
  historico: RepositorioHistorico;
  ocorrencias: RepositorioOcorrencias;
  ctrc: RepositorioCtrc;
  filtros: RepositorioFiltros;
  listagem: RepositorioListagem;
  performance: RepositorioPerformance;
  ranking: RepositorioRanking;
  cadastros: RepositorioCadastros;
  configuracoes: RepositorioConfiguracoes;
  logs: RepositorioLogs;
  plataforma: RepositorioPlataforma;
  prazos: RepositorioPrazos;
  usuarios: RepositorioUsuarios;
}

/**
 * `contexto`: o da transação (a empresa das leituras de configuração). `cacheDeConfiguracoes`: o
 * único da instância, o mesmo que o Admin invalida ao salvar.
 */
export function criarRepositorios(
  tx: Transacao,
  contexto: ContextoBanco,
  cacheDeConfiguracoes: CacheDeConfiguracoes,
): Repositorios {
  const configuracoes = criarLeitorDeConfiguracoes(
    carregarConfiguracoesDoBanco(tx),
    cacheDeConfiguracoes,
  );
  const daEmpresa = (chaves: readonly string[]) => configuracoes(contexto.empresaId, chaves);
  return {
    acesso: criarRepositorioAcesso(tx),
    ahgora: criarRepositorioAhgora(tx),
    auditoria: criarRepositorioAuditoria(tx),
    auth: criarRepositorioAuth(tx),
    bonificacaoEntrega: criarRepositorioBonificacaoEntrega(tx),
    calendario: criarRepositorioCalendario(tx),
    prazoParceiro: criarRepositorioPrazoParceiro(tx, daEmpresa),
    romaneio: criarRepositorioRomaneio(tx, daEmpresa),
    ingestao: criarRepositorioIngestao(tx),
    ingestaoSsw: criarRepositorioIngestaoSsw(tx),
    codigosOcorrencia: criarRepositorioCodigosOcorrencia(tx),
    coletas: criarRepositorioColetas(tx),
    comprovantes: criarRepositorioComprovantes(tx),
    historico: criarRepositorioHistorico(tx),
    ocorrencias: criarRepositorioOcorrencias(tx, configuracoes),
    ctrc: criarRepositorioCtrc(tx, configuracoes),
    filtros: criarRepositorioFiltros(tx),
    listagem: criarRepositorioListagem(tx),
    performance: criarRepositorioPerformance(tx),
    ranking: criarRepositorioRanking(tx),
    cadastros: criarRepositorioCadastros(tx),
    configuracoes: criarRepositorioConfiguracoes(tx, configuracoes),
    logs: criarRepositorioLogs(tx),
    plataforma: criarRepositorioPlataforma(tx),
    prazos: criarRepositorioPrazos(tx),
    usuarios: criarRepositorioUsuarios(tx),
  };
}

/** Abre uma transação com o contexto dado (RLS) e entrega os repositórios dela. */
export type ExecutorComContexto<K extends keyof Repositorios = keyof Repositorios> = <T>(
  contexto: ContextoBanco,
  fn: (repositorios: Pick<Repositorios, K>) => Promise<T>,
) => Promise<T>;

/** O mesmo, com o contexto já fixado pela requisição autenticada (`request.db`). */
export type Executor<K extends keyof Repositorios = keyof Repositorios> = <T>(
  fn: (repositorios: Pick<Repositorios, K>) => Promise<T>,
) => Promise<T>;
