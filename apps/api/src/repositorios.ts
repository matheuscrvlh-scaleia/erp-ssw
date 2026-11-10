import { type ContextoBanco, type Transacao } from "@erp/db";

import { type RepositorioAcesso } from "./modulos/acesso/casos-de-uso";
import { criarRepositorioAcesso } from "./modulos/acesso/repositorio";
import { type RepositorioAhgora } from "./modulos/ahgora/casos-de-uso";
import { criarRepositorioAhgora } from "./modulos/ahgora/repositorio";
import { type RepositorioAuditoria } from "./modulos/auditoria/auditoria";
import { criarRepositorioAuditoria } from "./modulos/auditoria/repositorio";
import { type RepositorioAuth } from "./modulos/auth/casos-de-uso";
import { criarRepositorioAuth } from "./modulos/auth/repositorio";
import { type RepositorioBonificacaoEntrega } from "./modulos/bonificacao-entrega/casos-de-uso";
import { criarRepositorioBonificacaoEntrega } from "./modulos/bonificacao-entrega/repositorio";
import { type RepositorioCalendario } from "./modulos/calendario/casos-de-uso";
import { criarRepositorioCalendario } from "./modulos/calendario/repositorio";
import { type RepositorioCtrc } from "./modulos/ctrc/casos-de-uso";
import { criarRepositorioCtrc } from "./modulos/ctrc/repositorio";
import { type RepositorioFiltros } from "./modulos/filtros/casos-de-uso";
import { criarRepositorioFiltros } from "./modulos/filtros/repositorio";
import { type RepositorioListagem } from "./modulos/listagem/casos-de-uso";
import { criarRepositorioListagem } from "./modulos/listagem/repositorio";
import { type RepositorioRanking } from "./modulos/ranking/casos-de-uso";
import { criarRepositorioRanking } from "./modulos/ranking/repositorio";

/**
 * Repositórios de todos os módulos, presos a uma transação com contexto. Módulo novo entra aqui
 * (interface no casos-de-uso.ts dele, implementação no repositorio.ts).
 */
export interface Repositorios {
  acesso: RepositorioAcesso;
  ahgora: RepositorioAhgora;
  auditoria: RepositorioAuditoria;
  auth: RepositorioAuth;
  bonificacaoEntrega: RepositorioBonificacaoEntrega;
  calendario: RepositorioCalendario;
  ctrc: RepositorioCtrc;
  filtros: RepositorioFiltros;
  listagem: RepositorioListagem;
  ranking: RepositorioRanking;
}

export function criarRepositorios(tx: Transacao): Repositorios {
  return {
    acesso: criarRepositorioAcesso(tx),
    ahgora: criarRepositorioAhgora(tx),
    auditoria: criarRepositorioAuditoria(tx),
    auth: criarRepositorioAuth(tx),
    bonificacaoEntrega: criarRepositorioBonificacaoEntrega(tx),
    calendario: criarRepositorioCalendario(tx),
    ctrc: criarRepositorioCtrc(tx),
    filtros: criarRepositorioFiltros(tx),
    listagem: criarRepositorioListagem(tx),
    ranking: criarRepositorioRanking(tx),
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
