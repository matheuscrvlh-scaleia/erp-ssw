import { type ContextoBanco, type Transacao } from "@erp/db";

import { criarRepositorioAcesso } from "./acesso/acesso.repository";
import { type RepositorioAcesso } from "./acesso/acesso.service";
import { criarRepositorioAhgora } from "./ahgora/ahgora.repository";
import { type RepositorioAhgora } from "./ahgora/ahgora.service";
import { criarRepositorioAuditoria } from "./auditoria/auditoria.repository";
import { type RepositorioAuditoria } from "./auditoria/auditoria.service";
import { criarRepositorioAuth } from "./auth/auth.repository";
import { type RepositorioAuth } from "./auth/auth.service";
import { criarRepositorioBonificacaoEntrega } from "./bonificacao-entrega/bonificacao-entrega.repository";
import { type RepositorioBonificacaoEntrega } from "./bonificacao-entrega/bonificacao-entrega.service";
import { criarRepositorioCadastros } from "./cadastros/cadastros.repository";
import { type RepositorioCadastros } from "./cadastros/cadastros.service";
import { criarRepositorioCalendario } from "./calendario/calendario.repository";
import { type RepositorioCalendario } from "./calendario/calendario.service";
import { criarRepositorioCodigosOcorrencia } from "./codigos-ocorrencia/codigos-ocorrencia.repository";
import { type RepositorioCodigosOcorrencia } from "./codigos-ocorrencia/codigos-ocorrencia.service";
import { criarRepositorioColetas } from "./coletas/coletas.repository";
import { type RepositorioColetas } from "./coletas/coletas.service";
import { criarRepositorioComprovantes } from "./comprovantes/comprovantes.repository";
import { type RepositorioComprovantes } from "./comprovantes/comprovantes.service";
import { type CacheDeConfiguracoes } from "./configuracoes/cache";
import { criarRepositorioConfiguracoes } from "./configuracoes/configuracoes.repository";
import { type RepositorioConfiguracoes } from "./configuracoes/configuracoes.service";
import { carregarConfiguracoesDoBanco, criarLeitorDeConfiguracoes } from "./configuracoes/leitor";
import { criarRepositorioCtrc } from "./ctrc/ctrc.repository";
import { type RepositorioCtrc } from "./ctrc/ctrc.service";
import { criarRepositorioFiltros } from "./filtros/filtros.repository";
import { type RepositorioFiltros } from "./filtros/filtros.service";
import { criarRepositorioHistorico } from "./historico/historico.repository";
import { type RepositorioHistorico } from "./historico/historico.service";
import { criarRepositorioIngestao } from "./ingestao/ingestao.repository";
import { type RepositorioIngestao } from "./ingestao/ingestao.service";
import { criarRepositorioIngestaoSsw } from "./ingestao-ssw/ingestao-ssw.repository";
import { type RepositorioIngestaoSsw } from "./ingestao-ssw/ingestao-ssw.service";
import { criarRepositorioListagem } from "./listagem/listagem.repository";
import { type RepositorioListagem } from "./listagem/listagem.service";
import { criarRepositorioLogs } from "./logs/logs.repository";
import { type RepositorioLogs } from "./logs/logs.service";
import { criarRepositorioOcorrencias } from "./ocorrencias/ocorrencias.repository";
import { type RepositorioOcorrencias } from "./ocorrencias/ocorrencias.service";
import { criarRepositorioPerformance } from "./performance/performance.repository";
import { type RepositorioPerformance } from "./performance/performance.service";
import { criarRepositorioPlataforma } from "./plataforma/plataforma.repository";
import { type RepositorioPlataforma } from "./plataforma/plataforma.service";
import { criarRepositorioPrazoParceiro } from "./prazo-parceiro/prazo-parceiro.repository";
import { type RepositorioPrazoParceiro } from "./prazo-parceiro/prazo-parceiro.service";
import { criarRepositorioPrazos } from "./prazos/prazos.repository";
import { type RepositorioPrazos } from "./prazos/prazos.service";
import { criarRepositorioRanking } from "./ranking/ranking.repository";
import { type RepositorioRanking } from "./ranking/ranking.service";
import { criarRepositorioRomaneio } from "./romaneio/romaneio.repository";
import { type RepositorioRomaneio } from "./romaneio/romaneio.service";
import { criarRepositorioUsuarios } from "./usuarios/usuarios.repository";
import { type RepositorioUsuarios } from "./usuarios/usuarios.service";

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
