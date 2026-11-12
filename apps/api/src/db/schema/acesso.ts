import { ACOES, EFEITOS } from "@erp/shared/acesso/permissoes";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  foreignKey,
  index,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";

import {
  atualizadoEm,
  criadoEm,
  daEmpresaOuPlataforma,
  erp,
  politicas,
  politicasDeEmpresaComPlataforma,
  usuarioDaSessao,
} from "./base";
import { unidades } from "./dominio/filiais";
import { usuarios } from "./identidade";
import { empresas, telas } from "./plataforma";

/**
 * Cargos por empresa = grupos de usuários com permissões (cada empresa edita os seus, Q30). As
 * chaves `super_admin`, `admin` e `gestor` têm significado fixo no código; a empresa nova recebe
 * os cargos padrão quando é criada. Departamento virou cargo.
 */
export const cargos = erp.table(
  "cargos",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    chave: text("chave").notNull(),
    rotulo: text("rotulo").notNull(),
    protegido: boolean("protegido").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.chave] }),
    ...politicasDeEmpresaComPlataforma("cargos", t.empresaId),
  ],
);

/**
 * Vínculo usuário × empresa: o cargo (`papel`) e a unidade valem por empresa.
 * `unidade_id` é o escopo de dados por unidade (Q26: uma regra só, desligada até existir a tela
 * que o grava; hoje todos veem tudo da própria empresa).
 */
export const empresaUsuarios = erp.table(
  "empresa_usuarios",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    papel: text("papel"),
    unidadeId: uuid("unidade_id").references((): AnyPgColumn => unidades.id, {
      onDelete: "set null",
    }),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.usuarioId] }),
    index("empresa_usuarios_usuario_idx").on(t.usuarioId),
    foreignKey({
      name: "empresa_usuarios_cargo_fk",
      columns: [t.empresaId, t.papel],
      foreignColumns: [cargos.empresaId, cargos.chave],
    }).onUpdate("cascade"),
    // O usuário lê os próprios vínculos em qualquer empresa (seletor de empresa).
    ...politicas("empresa_usuarios", {
      select: sql`(${daEmpresaOuPlataforma(t.empresaId)} or ${t.usuarioId} = ${usuarioDaSessao})`,
      insert: daEmpresaOuPlataforma(t.empresaId),
      update: daEmpresaOuPlataforma(t.empresaId),
      delete: daEmpresaOuPlataforma(t.empresaId),
    }),
  ],
);

/**
 * Permissões do cargo: ação (`ver`, `editar`, `excluir`) por tela. Admin e Super Admin têm o
 * catálogo inteiro pelo código e não gravam linhas aqui.
 */
export const cargoPermissoes = erp.table(
  "cargo_permissoes",
  {
    empresaId: uuid("empresa_id").notNull(),
    cargoChave: text("cargo_chave").notNull(),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
    acao: text("acao", { enum: ACOES }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.cargoChave, t.telaChave, t.acao] }),
    foreignKey({
      name: "cargo_permissoes_cargo_fk",
      columns: [t.empresaId, t.cargoChave],
      foreignColumns: [cargos.empresaId, cargos.chave],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    check("cargo_permissoes_acao_valida", sql`${t.acao} in ('ver', 'editar', 'excluir')`),
    ...politicasDeEmpresaComPlataforma("cargo_permissoes", t.empresaId),
  ],
);

/**
 * Exceção por usuário na empresa: "Sim" (`concede`) dá a permissão mesmo sem o cargo, "Não"
 * (`nega`) tira mesmo com o cargo; sem linha = "Padrão". Sai junto com o vínculo.
 */
export const usuarioPermissoes = erp.table(
  "usuario_permissoes",
  {
    empresaId: uuid("empresa_id").notNull(),
    usuarioId: uuid("usuario_id").notNull(),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
    acao: text("acao", { enum: ACOES }).notNull(),
    efeito: text("efeito", { enum: EFEITOS }).notNull(),
    criadoEm: criadoEm(),
    criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.usuarioId, t.telaChave, t.acao] }),
    foreignKey({
      name: "usuario_permissoes_vinculo_fk",
      columns: [t.empresaId, t.usuarioId],
      foreignColumns: [empresaUsuarios.empresaId, empresaUsuarios.usuarioId],
    }).onDelete("cascade"),
    index("usuario_permissoes_criado_por_idx").on(t.criadoPor),
    check("usuario_permissoes_acao_valida", sql`${t.acao} in ('ver', 'editar', 'excluir')`),
    check("usuario_permissoes_efeito_valido", sql`${t.efeito} in ('concede', 'nega')`),
    ...politicasDeEmpresaComPlataforma("usuario_permissoes", t.empresaId),
  ],
);
