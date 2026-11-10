/**
 * Contrato com a fundação (branch `onda0/fundacao`).
 *
 * O schema de domínio depende de quatro coisas que a fundação é dona: o schema `erp`, as tabelas
 * `empresas` e `usuarios`, e o jeito de declarar RLS por empresa. Este arquivo declara a forma
 * que o domínio espera, para o domínio compilar sozinho.
 *
 * TODO(fundacao): no merge, trocar o corpo deste arquivo por reexportações do que a fundação
 * criou (ex.: `export { esquemaErp, empresas, usuarios } from "../identidade"` e
 * `export { politicasDaEmpresa, ... } from "../../rls"`). As assinaturas abaixo são o contrato:
 * se a fundação usar outro nome, ajuste só aqui. As duas tabelas abaixo são esqueletos (só `id`)
 * e NÃO podem entrar numa migration: a definição real é a da fundação.
 */
import { sql, type SQL } from "drizzle-orm";
import { pgPolicy, pgSchema, uuid, type PgPolicy } from "drizzle-orm/pg-core";

/** Schema próprio do sistema novo. O `public` é o sistema atual e não é tocado. */
export const esquemaErp = pgSchema("erp");

/** Esqueleto de `erp.empresas` (dona: fundação). O domínio só referencia `id`. */
export const empresas = esquemaErp.table("empresas", {
  id: uuid("id").primaryKey(),
});

/** Esqueleto de `erp.usuarios` (dona: fundação). O domínio só referencia `id`. */
export const usuarios = esquemaErp.table("usuarios", {
  id: uuid("id").primaryKey(),
});

/**
 * Empresa da sessão, posta pelo backend com `SET LOCAL app.empresa_id` em cada transação.
 * Sem contexto, `current_setting(..., true)` devolve NULL (ou '' depois de um RESET) e a
 * comparação com `empresa_id` nunca é verdadeira: nenhuma linha.
 */
export const empresaDaSessao: SQL = sql`nullif(current_setting('app.empresa_id', true), '')::uuid`;

/** Sessão de administrador da Plataforma (`SET LOCAL app.plataforma = 'on'`). */
export const sessaoDePlataforma: SQL = sql`coalesce(current_setting('app.plataforma', true), 'off') = 'on'`;

/**
 * Políticas padrão de tabela de dado de cliente: lê e grava só a empresa da sessão.
 * A Plataforma não ganha exceção aqui de propósito: dado operacional de cliente só é lido com a
 * empresa ativa (a Plataforma troca de empresa ativa, não lê todas de uma vez).
 *
 * TODO(fundacao): substituir pelo helper real (mesmo nome e assinatura de preferência).
 */
export function politicasDaEmpresa(tabela: string): PgPolicy[] {
  const daEmpresa = sql`empresa_id = ${empresaDaSessao}`;
  return [
    pgPolicy(`${tabela}_empresa_select`, { for: "select", using: daEmpresa }),
    pgPolicy(`${tabela}_empresa_insert`, { for: "insert", withCheck: daEmpresa }),
    pgPolicy(`${tabela}_empresa_update`, {
      for: "update",
      using: daEmpresa,
      withCheck: daEmpresa,
    }),
    pgPolicy(`${tabela}_empresa_delete`, { for: "delete", using: daEmpresa }),
  ];
}
