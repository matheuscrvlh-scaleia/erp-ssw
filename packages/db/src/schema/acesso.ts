import { SETORES } from "@erp/shared/acesso/papeis";
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
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
 * Cargos (papéis) por empresa: cada empresa edita os seus (decisão Q30 do dono). As chaves
 * `super_admin`, `admin` e `gestor` têm significado fixo no código; a empresa nova recebe os
 * cargos padrão quando é criada.
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

export const cargoTelas = erp.table(
  "cargo_telas",
  {
    empresaId: uuid("empresa_id").notNull(),
    cargoChave: text("cargo_chave").notNull(),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.cargoChave, t.telaChave] }),
    foreignKey({
      name: "cargo_telas_cargo_fk",
      columns: [t.empresaId, t.cargoChave],
      foreignColumns: [cargos.empresaId, cargos.chave],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    ...politicasDeEmpresaComPlataforma("cargo_telas", t.empresaId),
  ],
);

export const departamentos = erp.table(
  "departamentos",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    chave: text("chave").notNull(),
    rotulo: text("rotulo").notNull(),
    descricao: text("descricao"),
    ativo: boolean("ativo").notNull().default(true),
    protegido: boolean("protegido").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.chave] }),
    ...politicasDeEmpresaComPlataforma("departamentos", t.empresaId),
  ],
);

export const departamentoTelas = erp.table(
  "departamento_telas",
  {
    empresaId: uuid("empresa_id").notNull(),
    departamentoChave: text("departamento_chave").notNull(),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.departamentoChave, t.telaChave] }),
    foreignKey({
      name: "departamento_telas_departamento_fk",
      columns: [t.empresaId, t.departamentoChave],
      foreignColumns: [departamentos.empresaId, departamentos.chave],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    ...politicasDeEmpresaComPlataforma("departamento_telas", t.empresaId),
  ],
);

/**
 * Vínculo usuário × empresa: papel, departamento, setor legado e unidade valem por empresa.
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
    departamentoChave: text("departamento_chave"),
    setor: text("setor", { enum: SETORES }),
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
    foreignKey({
      name: "empresa_usuarios_departamento_fk",
      columns: [t.empresaId, t.departamentoChave],
      foreignColumns: [departamentos.empresaId, departamentos.chave],
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

/** Exceção individual por empresa: adiciona (`permitido`) ou tira uma tela do usuário. */
export const usuarioTelas = erp.table(
  "usuario_telas",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
    permitido: boolean("permitido").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.usuarioId, t.telaChave] }),
    ...politicasDeEmpresaComPlataforma("usuario_telas", t.empresaId),
  ],
);
