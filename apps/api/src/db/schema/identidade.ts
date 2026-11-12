import { ACOES } from "@erp/shared/acesso/permissoes";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { atualizadoEm, criadoEm, erp } from "./base";
import { empresas, telas } from "./plataforma";

/*
 * Identidade é global (uma pessoa pode estar em várias empresas) e é lida antes de existir
 * contexto de empresa (login, refresh, redefinição de senha). Por isso estas tabelas não têm RLS:
 * quem protege é a API. Ver docs/adr/0002-rls-so-em-dado-de-empresa.md.
 */

export const usuarios = erp.table(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Sem citext (extensão nova é proibida): a API grava normalizado e o check garante.
    email: text("email").notNull().unique(),
    nome: text("nome"),
    senhaHash: text("senha_hash"),
    senhaAlgoritmo: text("senha_algoritmo", { enum: ["argon2id", "bcrypt"] }),
    ativo: boolean("ativo").notNull().default(true),
    tentativasFalhas: integer("tentativas_falhas").notNull().default(0),
    bloqueadoAte: timestamp("bloqueado_ate", { withTimezone: true, mode: "date" }),
    ultimoLoginEm: timestamp("ultimo_login_em", { withTimezone: true, mode: "date" }),
    /** Última empresa escolhida; o próximo login começa nela se o vínculo ainda valer. */
    empresaPreferidaId: uuid("empresa_preferida_id").references((): AnyPgColumn => empresas.id),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check("usuarios_email_normalizado", sql`${t.email} = lower(btrim(${t.email}))`),
    check("usuarios_senha_coerente", sql`(${t.senhaHash} is null) = (${t.senhaAlgoritmo} is null)`),
  ],
);

/** Refresh token opaco: só o hash fica no banco. Família = cadeia de rotações de um login. */
export const sessoes = erp.table(
  "sessoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    familiaId: uuid("familia_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    empresaAtivaId: uuid("empresa_ativa_id").references(() => empresas.id),
    criadoEm: criadoEm(),
    expiraEm: timestamp("expira_em", { withTimezone: true, mode: "date" }).notNull(),
    substituidaEm: timestamp("substituida_em", { withTimezone: true, mode: "date" }),
    revogadaEm: timestamp("revogada_em", { withTimezone: true, mode: "date" }),
    motivoRevogacao: text("motivo_revogacao", {
      enum: ["logout", "reuso_detectado", "senha_redefinida", "usuario_desativado", "inatividade"],
    }),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("sessoes_familia_idx").on(t.familiaId),
    index("sessoes_usuario_idx").on(t.usuarioId),
  ],
);

/** Token de uso único por e-mail: redefinição de senha e convite. Só o hash fica no banco. */
export const tokensSenha = erp.table(
  "tokens_senha",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: ["redefinicao", "convite"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiraEm: timestamp("expira_em", { withTimezone: true, mode: "date" }).notNull(),
    usadoEm: timestamp("usado_em", { withTimezone: true, mode: "date" }),
    criadoEm: criadoEm(),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
  },
  (t) => [index("tokens_senha_usuario_idx").on(t.usuarioId)],
);

/** Login social (Google). Só liga a um usuário que já existe: o cadastro é fechado. */
export const identidadesExternas = erp.table(
  "identidades_externas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    provedor: text("provedor", { enum: ["google"] }).notNull(),
    sujeito: text("sujeito").notNull(),
    email: text("email").notNull(),
    criadoEm: criadoEm(),
    ultimoUsoEm: timestamp("ultimo_uso_em", { withTimezone: true, mode: "date" }),
  },
  (t) => [unique("identidades_externas_provedor_sujeito").on(t.provedor, t.sujeito)],
);

/**
 * Cargos da equipe da Plataforma: o que cada pessoa da equipe vê e faz nas telas da Plataforma.
 * `super_admin` (protegido) tem todas as permissões pelo código e não grava linhas.
 */
export const plataformaCargos = erp.table("plataforma_cargos", {
  chave: text("chave").primaryKey(),
  rotulo: text("rotulo").notNull(),
  protegido: boolean("protegido").notNull().default(false),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

/** Permissões do cargo da Plataforma: ação (`ver`, `editar`, `excluir`) por tela da Plataforma. */
export const plataformaCargoPermissoes = erp.table(
  "plataforma_cargo_permissoes",
  {
    cargoChave: text("cargo_chave")
      .notNull()
      .references(() => plataformaCargos.chave, { onDelete: "cascade", onUpdate: "cascade" }),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
    acao: text("acao", { enum: ACOES }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.cargoChave, t.telaChave, t.acao] }),
    check(
      "plataforma_cargo_permissoes_acao_valida",
      sql`${t.acao} in ('ver', 'editar', 'excluir')`,
    ),
  ],
);

/** Equipe da Plataforma: entra em todas as empresas; o cargo diz o que faz na Plataforma. */
export const plataformaAdmins = erp.table(
  "plataforma_admins",
  {
    usuarioId: uuid("usuario_id")
      .primaryKey()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    cargo: text("cargo")
      .notNull()
      .default("super_admin")
      .references(() => plataformaCargos.chave, { onUpdate: "cascade" }),
    criadoEm: criadoEm(),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
  },
  (t) => [index("plataforma_admins_cargo_idx").on(t.cargo)],
);
