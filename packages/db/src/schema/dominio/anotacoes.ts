/**
 * Agregado Anotações do histórico (tela Histórico / Calendário / Dashboard).
 *
 * Nota de um dia (clima, feriado, operacional), opcionalmente de uma unidade.
 *
 * Origem: public.anotacoes.
 */
import { date, index, text, uuid } from "drizzle-orm/pg-core";

import { erp, politicasDeEmpresa } from "../base";
import { usuarios } from "../identidade";
import { atualizadoEm, criadoEm, empresaId } from "./_comum";
import { unidades } from "./filiais";

export const tipoAnotacao = erp.enum("tipo_anotacao", ["clima", "feriado", "operacional", "outro"]);

export const anotacoes = erp.table(
  "anotacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    empresaId: empresaId(),
    data: date("data", { mode: "string" }).notNull(),
    unidadeId: uuid("unidade_id").references(() => unidades.id, { onDelete: "set null" }),
    tipo: tipoAnotacao("tipo").notNull(),
    texto: text("texto").notNull(),
    autorId: uuid("autor_id").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("anotacoes_empresa_data_idx").on(t.empresaId, t.data),
    ...politicasDeEmpresa("anotacoes", t.empresaId),
  ],
);
