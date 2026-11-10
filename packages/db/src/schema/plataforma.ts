import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgPolicy,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import {
  atualizadoEm,
  criadoEm,
  daEmpresaOuPlataforma,
  ehPlataforma,
  empresaDaSessao,
  erp,
  papelWorker,
  politicas,
  usuarioDaSessao,
} from "./base";
import { usuarios } from "./identidade";

export const STATUS_EMPRESA = ["implantacao", "ativa", "suspensa", "encerrada"] as const;

/** Empresa (tenant) e a marca dela (menu, título da aba, exportações). */
export const empresas = erp.table(
  "empresas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    nome: text("nome").notNull(),
    nomeCurto: text("nome_curto").notNull(),
    razaoSocial: text("razao_social"),
    cnpj: text("cnpj"),
    /** Domínio da empresa no SSW (ex.: FRT). */
    dominioSsw: text("dominio_ssw"),
    /** Chave do logo no armazenamento S3; a URL pública é montada pela API. */
    logoCaminho: text("logo_caminho"),
    corPrimaria: text("cor_primaria").notNull().default("#212a63"),
    corDestaque: text("cor_destaque").notNull().default("#c0392b"),
    slogan: text("slogan"),
    fuso: text("fuso").notNull().default("America/Sao_Paulo"),
    status: text("status", { enum: STATUS_EMPRESA }).notNull().default("implantacao"),
    criadoEm: criadoEm(),
    criadoPor: uuid("criado_por").references((): AnyPgColumn => usuarios.id),
    atualizadoEm: atualizadoEm(),
    atualizadoPor: uuid("atualizado_por").references((): AnyPgColumn => usuarios.id),
  },
  (t) => [
    check("empresas_slug_formato", sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]*$'`),
    check("empresas_cor_primaria_hex", sql`${t.corPrimaria} ~ '^#[0-9a-fA-F]{6}$'`),
    check("empresas_cor_destaque_hex", sql`${t.corDestaque} ~ '^#[0-9a-fA-F]{6}$'`),
    ...politicas("empresas", {
      // A empresa da sessão, as empresas em que o usuário tem vínculo (seletor) e, para a
      // Plataforma, todas. Cadastro e alteração de empresa são só da Plataforma.
      select: sql`(${t.id} = ${empresaDaSessao} or ${ehPlataforma} or exists (
        select 1 from erp.empresa_usuarios eu
        where eu.empresa_id = ${t.id} and eu.usuario_id = ${usuarioDaSessao}))`,
      insert: ehPlataforma,
      update: ehPlataforma,
      delete: ehPlataforma,
    }),
  ],
);

/** Catálogo de telas (chaves de permissão). Seed em `seeds/catalogo.ts`. */
export const telas = erp.table("telas", {
  chave: text("chave").primaryKey(),
  rotulo: text("rotulo").notNull(),
});

/** Catálogo de módulos vendáveis. Seed em `seeds/catalogo.ts`. */
export const modulos = erp.table("modulos", {
  chave: text("chave").primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  essencial: boolean("essencial").notNull().default(false),
  ordem: integer("ordem").notNull().default(0),
});

export const moduloTelas = erp.table(
  "modulo_telas",
  {
    moduloChave: text("modulo_chave")
      .notNull()
      .references(() => modulos.chave, { onDelete: "cascade" }),
    telaChave: text("tela_chave")
      .notNull()
      .references(() => telas.chave, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.moduloChave, t.telaChave] })],
);

/** Liberação de módulo por empresa, com vigência opcional (datas no fuso da empresa). */
export const empresaModulos = erp.table(
  "empresa_modulos",
  {
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    moduloChave: text("modulo_chave")
      .notNull()
      .references(() => modulos.chave),
    ativo: boolean("ativo").notNull().default(true),
    inicio: date("inicio", { mode: "string" }),
    fim: date("fim", { mode: "string" }),
    observacao: text("observacao"),
    atualizadoEm: atualizadoEm(),
    atualizadoPor: uuid("atualizado_por").references(() => usuarios.id),
  },
  (t) => [
    primaryKey({ columns: [t.empresaId, t.moduloChave] }),
    check(
      "empresa_modulos_vigencia",
      sql`${t.inicio} is null or ${t.fim} is null or ${t.inicio} <= ${t.fim}`,
    ),
    // A empresa lê o que tem liberado; quem libera é a Plataforma.
    ...politicas("empresa_modulos", {
      select: daEmpresaOuPlataforma(t.empresaId),
      insert: ehPlataforma,
      update: ehPlataforma,
      delete: ehPlataforma,
    }),
  ],
);

export const TIPOS_INTEGRACAO = [
  "sftp",
  "ssw_api",
  "ssw_bi2",
  "ssw_webhook",
  "ahgora",
  "xml_cte",
  "ingestao_publica",
] as const;

/**
 * Integração por empresa. O segredo (senha/token) fica cifrado com AES-256-GCM pela aplicação
 * (`segredos.ts`); `segredo_versao_chave` diz com qual chave mestra, para permitir rotação.
 */
export const empresaIntegracoes = erp.table(
  "empresa_integracoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id")
      .notNull()
      .references(() => empresas.id, { onDelete: "cascade" }),
    tipo: text("tipo", { enum: TIPOS_INTEGRACAO }).notNull(),
    ativo: boolean("ativo").notNull().default(false),
    parametros: jsonb("parametros").$type<Record<string, unknown>>().notNull().default({}),
    segredoCifrado: text("segredo_cifrado"),
    segredoVersaoChave: integer("segredo_versao_chave"),
    segredoDefinidoEm: timestamp("segredo_definido_em", { withTimezone: true, mode: "date" }),
    /**
     * Segredo trocado por último (só o do webhook SSW), cifrado com o mesmo contexto: o
     * reprocesso de "token incorreto" aceita eventos assinados com ele.
     */
    segredoAnteriorCifrado: text("segredo_anterior_cifrado"),
    segredoAnteriorVersaoChave: integer("segredo_anterior_versao_chave"),
    ultimoTesteEm: timestamp("ultimo_teste_em", { withTimezone: true, mode: "date" }),
    ultimoTesteOk: boolean("ultimo_teste_ok"),
    ultimoTesteMsg: text("ultimo_teste_msg"),
    atualizadoEm: atualizadoEm(),
    atualizadoPor: uuid("atualizado_por").references(() => usuarios.id),
  },
  (t) => [
    unique("empresa_integracoes_empresa_tipo").on(t.empresaId, t.tipo),
    check(
      "empresa_integracoes_segredo_coerente",
      sql`(${t.segredoCifrado} is null) = (${t.segredoVersaoChave} is null)`,
    ),
    check(
      "empresa_integracoes_segredo_anterior_coerente",
      sql`(${t.segredoAnteriorCifrado} is null) = (${t.segredoAnteriorVersaoChave} is null)`,
    ),
    // O worker lê no contexto da empresa; só a Plataforma cadastra e altera.
    ...politicas("empresa_integracoes", {
      select: daEmpresaOuPlataforma(t.empresaId),
      insert: ehPlataforma,
      update: ehPlataforma,
      delete: ehPlataforma,
    }),
  ],
);

/** Configuração por empresa; `empresa_id` nulo = valor da plataforma (padrão de todas). */
export const configuracoes = erp.table(
  "configuracoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: uuid("empresa_id").references(() => empresas.id, { onDelete: "cascade" }),
    chave: text("chave").notNull(),
    valor: text("valor").notNull(),
    descricao: text("descricao").notNull(),
    grupo: text("grupo").notNull(),
    atualizadoEm: atualizadoEm(),
    atualizadoPor: uuid("atualizado_por").references(() => usuarios.id),
  },
  (t) => [
    unique("configuracoes_empresa_chave").on(t.empresaId, t.chave).nullsNotDistinct(),
    ...politicas("configuracoes", {
      select: sql`(${daEmpresaOuPlataforma(t.empresaId)} or ${t.empresaId} is null)`,
      insert: daEmpresaOuPlataforma(t.empresaId),
      update: daEmpresaOuPlataforma(t.empresaId),
      delete: daEmpresaOuPlataforma(t.empresaId),
    }),
    // O worker-ssw só grava a pausa do FTP (ADR 0012): restritivas, somam à regra da empresa.
    pgPolicy("configuracoes_insert_worker", {
      as: "restrictive",
      for: "insert",
      to: papelWorker,
      withCheck: sql`${t.chave} = 'ftp_sync_ativo'`,
    }),
    pgPolicy("configuracoes_update_worker", {
      as: "restrictive",
      for: "update",
      to: papelWorker,
      using: sql`${t.chave} = 'ftp_sync_ativo'`,
      withCheck: sql`${t.chave} = 'ftp_sync_ativo'`,
    }),
  ],
);

export const TIPOS_ATOR = ["usuario", "plataforma", "sistema", "integracao"] as const;

/**
 * Auditoria (quem mudou o quê), gravada pelo caso de uso na mesma transação da mudança.
 * `empresa_id` nulo = ação fora de empresa (Plataforma ou a própria conta do usuário).
 * O app só insere e lê: sem política de UPDATE/DELETE, ninguém altera o histórico.
 */
export const auditoria = erp.table(
  "auditoria",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    empresaId: uuid("empresa_id").references(() => empresas.id),
    atorId: uuid("ator_id").references(() => usuarios.id),
    atorEmail: text("ator_email"),
    atorTipo: text("ator_tipo", { enum: TIPOS_ATOR }).notNull(),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: text("entidade_id"),
    resumo: text("resumo"),
    antes: jsonb("antes").$type<Record<string, unknown>>(),
    depois: jsonb("depois").$type<Record<string, unknown>>(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("auditoria_empresa_criado_idx").on(t.empresaId, t.criadoEm.desc()),
    index("auditoria_criado_idx").on(t.criadoEm.desc()),
    // Histórico de um registro (aba Histórico do código de ocorrência, e de feriado etc.).
    index("auditoria_entidade_idx").on(t.empresaId, t.entidade, t.entidadeId, t.criadoEm.desc()),
    ...politicas("auditoria", {
      select: daEmpresaOuPlataforma(t.empresaId),
      insert: sql`(${daEmpresaOuPlataforma(t.empresaId)}
        or (${t.empresaId} is null and ${t.atorId} = ${usuarioDaSessao}))`,
    }),
  ],
);
