import { type ContextoBanco, type Transacao } from "@erp/db";

import { type RepositorioAcesso } from "./modulos/acesso/casos-de-uso";
import { criarRepositorioAcesso } from "./modulos/acesso/repositorio";
import { type RepositorioAuditoria } from "./modulos/auditoria/auditoria";
import { criarRepositorioAuditoria } from "./modulos/auditoria/repositorio";
import { type RepositorioAuth } from "./modulos/auth/casos-de-uso";
import { criarRepositorioAuth } from "./modulos/auth/repositorio";
import { type RepositorioCalendario } from "./modulos/calendario/casos-de-uso";
import { criarRepositorioCalendario } from "./modulos/calendario/repositorio";
import { type RepositorioCodigosOcorrencia } from "./modulos/codigos-ocorrencia/casos-de-uso";
import { criarRepositorioCodigosOcorrencia } from "./modulos/codigos-ocorrencia/repositorio";
import { type RepositorioColetas } from "./modulos/coletas/casos-de-uso";
import { criarRepositorioColetas } from "./modulos/coletas/repositorio";
import { type RepositorioComprovantes } from "./modulos/comprovantes/casos-de-uso";
import { criarRepositorioComprovantes } from "./modulos/comprovantes/repositorio";
import { type RepositorioHistorico } from "./modulos/historico/casos-de-uso";
import { criarRepositorioHistorico } from "./modulos/historico/repositorio";
import { type RepositorioOcorrencias } from "./modulos/ocorrencias/casos-de-uso";
import { criarRepositorioOcorrencias } from "./modulos/ocorrencias/repositorio";

/**
 * Repositórios de todos os módulos, presos a uma transação com contexto. Módulo novo entra aqui
 * (interface no casos-de-uso.ts dele, implementação no repositorio.ts).
 */
export interface Repositorios {
  acesso: RepositorioAcesso;
  auditoria: RepositorioAuditoria;
  auth: RepositorioAuth;
  calendario: RepositorioCalendario;
  codigosOcorrencia: RepositorioCodigosOcorrencia;
  coletas: RepositorioColetas;
  comprovantes: RepositorioComprovantes;
  historico: RepositorioHistorico;
  ocorrencias: RepositorioOcorrencias;
}

export function criarRepositorios(tx: Transacao): Repositorios {
  return {
    acesso: criarRepositorioAcesso(tx),
    auditoria: criarRepositorioAuditoria(tx),
    auth: criarRepositorioAuth(tx),
    calendario: criarRepositorioCalendario(tx),
    codigosOcorrencia: criarRepositorioCodigosOcorrencia(tx),
    coletas: criarRepositorioColetas(tx),
    comprovantes: criarRepositorioComprovantes(tx),
    historico: criarRepositorioHistorico(tx),
    ocorrencias: criarRepositorioOcorrencias(tx),
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
