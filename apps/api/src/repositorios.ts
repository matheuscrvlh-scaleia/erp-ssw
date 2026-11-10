import { type ContextoBanco, type Transacao } from "@erp/db";

import { type RepositorioAcesso } from "./modulos/acesso/casos-de-uso";
import { criarRepositorioAcesso } from "./modulos/acesso/repositorio";
import { type RepositorioAuditoria } from "./modulos/auditoria/auditoria";
import { criarRepositorioAuditoria } from "./modulos/auditoria/repositorio";
import { type RepositorioAuth } from "./modulos/auth/casos-de-uso";
import { criarRepositorioAuth } from "./modulos/auth/repositorio";
import { type RepositorioCadastros } from "./modulos/cadastros/casos-de-uso";
import { criarRepositorioCadastros } from "./modulos/cadastros/repositorio";
import { type RepositorioCalendario } from "./modulos/calendario/casos-de-uso";
import { criarRepositorioCalendario } from "./modulos/calendario/repositorio";
import { type RepositorioConfiguracoes } from "./modulos/configuracoes/casos-de-uso";
import { criarRepositorioConfiguracoes } from "./modulos/configuracoes/repositorio";
import { type RepositorioLogs } from "./modulos/logs/casos-de-uso";
import { criarRepositorioLogs } from "./modulos/logs/repositorio";
import { type RepositorioPlataforma } from "./modulos/plataforma/casos-de-uso";
import { criarRepositorioPlataforma } from "./modulos/plataforma/repositorio";
import { type RepositorioPrazos } from "./modulos/prazos/casos-de-uso";
import { criarRepositorioPrazos } from "./modulos/prazos/repositorio";
import { type RepositorioUsuarios } from "./modulos/usuarios/casos-de-uso";
import { criarRepositorioUsuarios } from "./modulos/usuarios/repositorio";

/**
 * Repositórios de todos os módulos, presos a uma transação com contexto. Módulo novo entra aqui
 * (interface no casos-de-uso.ts dele, implementação no repositorio.ts).
 */
export interface Repositorios {
  acesso: RepositorioAcesso;
  auditoria: RepositorioAuditoria;
  auth: RepositorioAuth;
  cadastros: RepositorioCadastros;
  calendario: RepositorioCalendario;
  configuracoes: RepositorioConfiguracoes;
  logs: RepositorioLogs;
  plataforma: RepositorioPlataforma;
  prazos: RepositorioPrazos;
  usuarios: RepositorioUsuarios;
}

export function criarRepositorios(tx: Transacao): Repositorios {
  return {
    acesso: criarRepositorioAcesso(tx),
    auditoria: criarRepositorioAuditoria(tx),
    auth: criarRepositorioAuth(tx),
    cadastros: criarRepositorioCadastros(tx),
    calendario: criarRepositorioCalendario(tx),
    configuracoes: criarRepositorioConfiguracoes(tx),
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
