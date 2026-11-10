/**
 * Agregado Filiais e Unidades.
 *
 * - `filiais`: catálogo de filiais do SSW (sigla), por empresa. `propria` define o universo das
 *   telas: CT-e cuja filial efetiva é própria aparece; o resto não.
 * - `filiais_apelidos`: cidade (normalizada) que o SSW escreve no complemento → sigla da filial.
 * - `unidades`: unidades operacionais da empresa (escopo de usuário, equipe, meta, anotação).
 *   Não é a mesma coisa que filial: hoje `unidades` tem 7 linhas e `filiais_ssw` 23.
 *
 * Origem: public.filiais_ssw, public.filial_alias, public.unidades.
 */
import { sql } from "drizzle-orm";
import { boolean, check, index, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm, empresaId } from "./_comum";
import { esquemaErp, politicasDaEmpresa } from "./_contrato-fundacao";

export const filiais = esquemaErp.table(
  "filiais",
  {
    empresaId: empresaId(),
    sigla: text("sigla").notNull(),
    tipo: text("tipo").notNull(),
    nome: text("nome").notNull(),
    razaoSocial: text("razao_social"),
    cnpj: text("cnpj"),
    cidade: text("cidade"),
    uf: text("uf"),
    /**
     * Filial do universo da empresa. Marcada pela Plataforma; a ingestão do cadastro SSW não
     * altera.
     */
    propria: boolean("propria").notNull().default(false),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    primaryKey({ name: "filiais_pk", columns: [t.empresaId, t.sigla] }),
    check(
      "filiais_sigla_maiuscula",
      sql`${t.sigla} = upper(btrim(${t.sigla})) and ${t.sigla} <> ''`,
    ),
    index("filiais_propria_idx")
      .on(t.empresaId)
      .where(sql`${t.propria}`),
    ...politicasDaEmpresa("filiais"),
  ],
);

export const filiaisApelidos = esquemaErp.table(
  "filiais_apelidos",
  {
    empresaId: empresaId(),
    cidadeNormalizada: text("cidade_normalizada").notNull(),
    filial: text("filial").notNull(),
  },
  (t) => [
    primaryKey({ name: "filiais_apelidos_pk", columns: [t.empresaId, t.cidadeNormalizada] }),
    ...politicasDaEmpresa("filiais_apelidos"),
  ],
);

export const unidades = esquemaErp.table(
  "unidades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    nome: text("nome").notNull(),
    cidade: text("cidade").notNull(),
    uf: text("uf").notNull(),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [index("unidades_empresa_idx").on(t.empresaId), ...politicasDaEmpresa("unidades")],
);
