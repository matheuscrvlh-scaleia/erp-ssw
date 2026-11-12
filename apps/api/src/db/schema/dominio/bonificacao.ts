/**
 * Agregado Bonificação.
 *
 * Dois usos vivos hoje:
 * - Ranking > Regras: `bonificacao_regras` + `bonificacao_regra_criterios` (critérios de pontos
 *   por equipe). A apuração por equipe é calculada na consulta, não é gravada.
 * - Apuração do ponto (Ahgora): `bonificacao_parametros` (taxas e metas com vigência),
 *   `bonificacao_faltas` (falta zera o último dia bonificado anterior) e `bonificacao_codigos`
 *   (classificação dos códigos SSW só para o bônus, diferente da das telas de ocorrência).
 *   As horas extras vêm da API do Ahgora na hora da apuração; nada do ponto é persistido.
 *
 * Origem: public.regras_bonificacao, public.regra_criterios, public.bonificacao_parametros,
 * public.bonificacao_faltas, public.bonificacao_codigos.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  primaryKey,
  smallint,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { erp, politicasDeEmpresa } from "../base";
import { usuarios } from "../identidade";
import { atualizadoEm, criadoEm, empresaId } from "./_comum";

const dia = (nome: string) => date(nome, { mode: "string" });

export const bonificacaoRegras = erp.table(
  "bonificacao_regras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    vigenciaInicio: dia("vigencia_inicio").notNull(),
    vigenciaFim: dia("vigencia_fim"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    check(
      "bonificacao_regras_vigencia_ck",
      sql`${t.vigenciaFim} is null or ${t.vigenciaFim} >= ${t.vigenciaInicio}`,
    ),
    index("bonificacao_regras_empresa_idx").on(t.empresaId, t.vigenciaInicio),
    ...politicasDeEmpresa("bonificacao_regras", t.empresaId),
  ],
);

/** Critérios aceitos por regra. Os parâmetros de cada um são validados por zod no backend. */
export const criteriosDeBonificacao = [
  "entregas_prazo",
  "penalizante",
  "meta_produtividade",
  "piso_performance",
  "livre",
] as const;

export const bonificacaoRegraCriterios = erp.table(
  "bonificacao_regra_criterios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    regraId: uuid("regra_id")
      .notNull()
      .references(() => bonificacaoRegras.id, { onDelete: "cascade" }),
    criterio: text("criterio", { enum: criteriosDeBonificacao }).notNull(),
    parametros: jsonb("parametros")
      .notNull()
      .default(sql`'{}'::jsonb`),
    ordem: integer("ordem").notNull().default(0),
    criadoEm: criadoEm(),
  },
  (t) => [
    check(
      "bonificacao_regra_criterios_criterio_ck",
      sql`${t.criterio} in ('entregas_prazo', 'penalizante', 'meta_produtividade', 'piso_performance', 'livre')`,
    ),
    index("bonificacao_regra_criterios_regra_idx").on(t.regraId, t.ordem),
    ...politicasDeEmpresa("bonificacao_regra_criterios", t.empresaId),
  ],
);

export const bonificacaoParametros = erp.table(
  "bonificacao_parametros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    vigenciaInicio: dia("vigencia_inicio").notNull(),
    vigenciaFim: dia("vigencia_fim"),
    taxaTurbo: numeric("taxa_turbo", { precision: 10, scale: 4 }).notNull(),
    taxaAcelerado: numeric("taxa_acelerado", { precision: 10, scale: 4 }).notNull(),
    taxaEmRotaGrande: numeric("taxa_em_rota_grande", { precision: 10, scale: 4 }).notNull(),
    taxaEmRotaPequena: numeric("taxa_em_rota_pequena", { precision: 10, scale: 4 }).notNull(),
    metaRotaPequena: numeric("meta_rota_pequena", { precision: 5, scale: 4 }).notNull(),
    metaRotaGrande: numeric("meta_rota_grande", { precision: 5, scale: 4 }).notNull(),
    metaEmRota: numeric("meta_em_rota", { precision: 5, scale: 4 }).notNull(),
    limiteNfsRotaPequena: integer("limite_nfs_rota_pequena").notNull().default(15),
    criadoPor: uuid("criado_por").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    check(
      "bonificacao_parametros_vigencia_ck",
      sql`${t.vigenciaFim} is null or ${t.vigenciaFim} >= ${t.vigenciaInicio}`,
    ),
    index("bonificacao_parametros_vigencia_idx").on(t.empresaId, t.vigenciaInicio),
    ...politicasDeEmpresa("bonificacao_parametros", t.empresaId),
  ],
);

export const tiposDeFalta = ["falta_injustificada", "dois_dias_abaixo_minimo", "outro"] as const;

export const bonificacaoFaltas = erp.table(
  "bonificacao_faltas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    colaboradorNome: text("colaborador_nome").notNull(),
    dataFalta: dia("data_falta").notNull(),
    tipo: text("tipo", { enum: tiposDeFalta }).notNull(),
    observacao: text("observacao"),
    registradoPor: uuid("registrado_por").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    check(
      "bonificacao_faltas_tipo_ck",
      sql`${t.tipo} in ('falta_injustificada', 'dois_dias_abaixo_minimo', 'outro')`,
    ),
    // Uma falta por pessoa por dia (a planilha antiga deixava duas apontarem para o mesmo dia).
    unique("bonificacao_faltas_pessoa_dia_uq").on(t.empresaId, t.colaboradorNome, t.dataFalta),
    ...politicasDeEmpresa("bonificacao_faltas", t.empresaId),
  ],
);

export const bonificacaoEfeito = erp.enum("bonificacao_efeito", ["penaliza", "sac", "verificar"]);

export const bonificacaoCodigos = erp.table(
  "bonificacao_codigos",
  {
    empresaId: empresaId(),
    codigo: smallint("codigo").notNull(),
    efeito: bonificacaoEfeito("efeito").notNull(),
    observacao: text("observacao"),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    primaryKey({ name: "bonificacao_codigos_pk", columns: [t.empresaId, t.codigo] }),
    check("bonificacao_codigos_codigo_ck", sql`${t.codigo} between 0 and 99`),
    ...politicasDeEmpresa("bonificacao_codigos", t.empresaId),
  ],
);
