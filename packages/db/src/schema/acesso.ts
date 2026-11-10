import { SETORES } from "@erp/shared/acesso/papeis";
import { sql } from "drizzle-orm";
import { boolean, foreignKey, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";

import {
  atualizadoEm,
  criadoEm,
  daEmpresaOuPlataforma,
  erp,
  politicas,
  politicasDeEmpresaComPlataforma,
  usuarioDaSessao,
} from "./base";
import { usuarios } from "./identidade";
import { empresas, telas } from "./plataforma";

/**
 * Cargos (papéis) são um catálogo global editado só pela Plataforma (decisão em aberto no
 * sistema atual: virar por empresa). Sem RLS: a API só expõe escrita à Plataforma.
 */
export const cargos = erp.table("cargos", {
  chave: text("chave").primaryKey(),
  rotulo: text("rotulo").notNull(),
  protegido: boolean("protegido").notNull().default(false),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const cargoTelas = erp.table(
  "cargo_telas",
  {
    cargoChave: text("cargo_chave")
      .notNull()
      .references(() => cargos.chave, { onDelete: "cascade", onUpdate: "cascade" }),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.cargoChave, t.telaChave] })],
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
 * `unidade_id` aponta para `unidades` (tabela de domínio); a FK entra com o schema de domínio.
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
    papel: text("papel").references(() => cargos.chave, { onUpdate: "cascade" }),
    departamentoChave: text("departamento_chave"),
    setor: text("setor", { enum: SETORES }),
    unidadeId: uuid("unidade_id"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    criadoPor: uuid("criado_por").references(() => usuarios.id),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.usuarioId] }),
    index("empresa_usuarios_usuario_idx").on(t.usuarioId),
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
