import { type SQL, sql } from "drizzle-orm";
import { type AnyPgColumn, pgPolicy, pgRole, pgSchema, timestamp } from "drizzle-orm/pg-core";

/** Schema próprio do sistema novo; o `public` é do sistema atual e não é tocado. */
export const erp = pgSchema("erp");

/**
 * Papéis do banco. Criados uma vez pelo DBA (`bootstrap/papeis.sql`), com senha fora do
 * repositório; as migrations só os referenciam. `erp_app` (API) e `erp_worker` (worker-ssw, ADR
 * 0012) não têm BYPASSRLS; o `erp_worker` só tem GRANT nas tabelas que a ingestão usa.
 */
export const papelApp = pgRole("erp_app").existing();
export const papelWorker = pgRole("erp_worker").existing();
export const papelMigracao = pgRole("erp_migracao").existing();

/**
 * Contexto da requisição, gravado com `SET LOCAL` por `comContexto`. Sem contexto, as
 * expressões viram NULL/false e as políticas não devolvem nenhuma linha.
 */
export const empresaDaSessao = sql`nullif(current_setting('app.empresa_id', true), '')::uuid`;
export const usuarioDaSessao = sql`nullif(current_setting('app.usuario_id', true), '')::uuid`;
export const ehPlataforma = sql`coalesce(current_setting('app.plataforma', true), 'off') = 'on'`;

export function daEmpresa(coluna: AnyPgColumn): SQL {
  return sql`${coluna} = ${empresaDaSessao}`;
}

export function daEmpresaOuPlataforma(coluna: AnyPgColumn): SQL {
  return sql`(${daEmpresa(coluna)} or ${ehPlataforma})`;
}

const OPERACOES = ["select", "insert", "update", "delete"] as const;
type Operacao = (typeof OPERACOES)[number];

type Papel = typeof papelApp;
const PAPEIS_DA_SESSAO: readonly Papel[] = [papelApp, papelWorker];

function politica(tabela: string, operacao: Operacao, regra: SQL, papeis: readonly Papel[]) {
  const usaUsing = operacao !== "insert";
  const usaCheck = operacao === "insert" || operacao === "update";
  return pgPolicy(`${tabela}_${operacao}`, {
    as: "permissive",
    for: operacao,
    // O mesmo contexto (`SET LOCAL`) vale para a API e para o worker-ssw.
    to: [...papeis],
    ...(usaUsing ? { using: regra } : {}),
    ...(usaCheck ? { withCheck: regra } : {}),
  });
}

/**
 * Políticas RLS de uma tabela, uma por operação. Operação sem regra fica sem política, ou seja,
 * negada para o app (ex.: UPDATE/DELETE em `auditoria`).
 */
export function politicas(
  tabela: string,
  regras: Partial<Record<Operacao, SQL>>,
  papeis: readonly Papel[] = PAPEIS_DA_SESSAO,
): ReturnType<typeof pgPolicy>[] {
  return OPERACOES.flatMap((operacao) => {
    const regra = regras[operacao];
    return regra ? [politica(tabela, operacao, regra, papeis)] : [];
  });
}

/** Dado da empresa: só a empresa da sessão lê e escreve. */
export function politicasDeEmpresa(tabela: string, coluna: AnyPgColumn) {
  const regra = daEmpresa(coluna);
  return politicas(tabela, { select: regra, insert: regra, update: regra, delete: regra });
}

/** Cadastro da empresa que a equipe da Plataforma também administra (vê todas). */
export function politicasDeEmpresaComPlataforma(tabela: string, coluna: AnyPgColumn) {
  const regra = daEmpresaOuPlataforma(coluna);
  return politicas(tabela, { select: regra, insert: regra, update: regra, delete: regra });
}

export const criadoEm = () =>
  timestamp("criado_em", { withTimezone: true, mode: "date" }).defaultNow().notNull();

export const atualizadoEm = () =>
  timestamp("atualizado_em", { withTimezone: true, mode: "date" }).defaultNow().notNull();
