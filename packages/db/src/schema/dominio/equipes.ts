/**
 * Agregado Equipes de entrega (ranking).
 *
 * - `equipes`: equipe de entrega de uma unidade, com o link público do ranking.
 * - `equipe_membros`: motorista e ajudantes (posição 1 a 3) da equipe, com saída datada.
 *
 * Link público do ranking (`/ranking/publico/<token>`): a URL continua a mesma, mas o banco
 * guarda só o SHA-256 do token (`token_publico_hash`). O backend compara o hash do token da URL;
 * um vazamento do banco não entrega links válidos. O migrador calcula o hash dos tokens atuais.
 *
 * Origem: public.equipes_entrega, public.membros_equipe.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgPolicy,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { atualizadoEm, criadoEm, empresaId } from "./_comum";
import { esquemaErp, politicasDaEmpresa, usuarios } from "./_contrato-fundacao";
import { unidades } from "./filiais";

export const equipes = esquemaErp.table(
  "equipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    nome: text("nome").notNull(),
    unidadeId: uuid("unidade_id").references(() => unidades.id, { onDelete: "restrict" }),
    ativo: boolean("ativo").notNull().default(true),
    /** SHA-256 (hex) do token do link público. Nulo = equipe sem link. */
    tokenPublicoHash: text("token_publico_hash"),
    tokenPublicoRevogado: boolean("token_publico_revogado").notNull().default(false),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    // Busca do link público: a rota pública resolve o token antes de saber a empresa, por isso
    // o índice é global (o hash é único no sistema inteiro).
    uniqueIndex("equipes_token_publico_uq").on(t.tokenPublicoHash),
    index("equipes_empresa_unidade_idx").on(t.empresaId, t.unidadeId),
    ...politicasDaEmpresa("equipes"),
    // Rota pública do ranking: sem empresa na sessão, o backend põe
    // `SET LOCAL app.token_publico_hash` e enxerga só a equipe daquele link (não revogado).
    // Achada a equipe, ele põe `app.empresa_id` dela para ler o ranking.
    pgPolicy("equipes_token_publico_select", {
      for: "select",
      using: sql`not ${t.tokenPublicoRevogado}
        and ${t.tokenPublicoHash} = nullif(current_setting('app.token_publico_hash', true), '')`,
    }),
  ],
);

export const equipeMembros = esquemaErp.table(
  "equipe_membros",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    equipeId: uuid("equipe_id")
      .notNull()
      .references(() => equipes.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    nome: text("nome").notNull(),
    papel: text("papel", { enum: ["motorista", "ajudante"] }).notNull(),
    cpf: text("cpf"),
    /** Posição do ajudante (1 a 3). Motorista: nulo. */
    posicao: smallint("posicao"),
    /** Nulo = membro ativo. */
    dataSaida: date("data_saida", { mode: "string" }),
    criadoEm: criadoEm(),
  },
  (t) => [
    check("equipe_membros_papel_ck", sql`${t.papel} in ('motorista', 'ajudante')`),
    check(
      "equipe_membros_posicao_ck",
      sql`(${t.papel} = 'ajudante' and ${t.posicao} between 1 and 3)
        or (${t.papel} <> 'ajudante' and (${t.posicao} is null or ${t.posicao} = 0))`,
    ),
    uniqueIndex("equipe_membros_posicao_ativa_uq")
      .on(t.equipeId, t.posicao)
      .where(sql`${t.dataSaida} is null and ${t.posicao} > 0`),
    index("equipe_membros_equipe_idx").on(t.equipeId),
    index("equipe_membros_usuario_ativo_idx")
      .on(t.empresaId, t.usuarioId)
      .where(sql`${t.dataSaida} is null`),
    ...politicasDaEmpresa("equipe_membros"),
  ],
);
