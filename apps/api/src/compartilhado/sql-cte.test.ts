import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  atraso,
  casaAlgumPadrao,
  COLUNAS_DO_CTE,
  colunasDoApelido,
  diaNoFuso,
  tipoDocumentoDoFiltro,
} from "./sql-cte";

const dialeto = new PgDialect();
const render = (consulta: Parameters<PgDialect["sqlToQuery"]>[0]) => dialeto.sqlToQuery(consulta);
const regra = { baixas: [12, 99], hoje: "2026-11-10", fuso: "America/Manaus" };

describe("SQL comum do CT-e", () => {
  it("atraso é a mesma regra pela tabela e pelo apelido, com hoje e fuso como parâmetro", () => {
    const pelaTabela = render(atraso(COLUNAS_DO_CTE, regra));
    const peloApelido = render(atraso(colunasDoApelido("c"), regra));
    const params = ["America/Manaus", [1, 18, 67], [12, 99], "2026-11-10"];
    expect(pelaTabela.params).toEqual(params);
    expect(peloApelido.params).toEqual(params);
    expect(peloApelido.sql).toContain('"c"."data_prevista_entrega"');
    expect(peloApelido.sql.replaceAll('"c".', '"ctes".')).toBe(
      pelaTabela.sql.replaceAll('"erp".', ""),
    );
  });

  it("dia no fuso dado, nunca fixo", () => {
    const q = render(diaNoFuso(COLUNAS_DO_CTE.dataEntregaRealizada, "America/Manaus"));
    expect(q.sql).toContain("AT TIME ZONE $1)::date");
    expect(q.params).toEqual(["America/Manaus"]);
  });

  it("tipo do filtro: sem tipo vira __SEM_TIPO__", () => {
    const q = render(tipoDocumentoDoFiltro(colunasDoApelido("c")));
    expect(q.sql).toBe(
      `coalesce(nullif(upper(coalesce(nullif(btrim("c"."tipo_documento_455"), ''), btrim("c"."tipo_documento"))), ''), $1)`,
    );
    expect(q.params).toEqual(["__SEM_TIPO__"]);
  });

  it("vários padrões de texto viram um ILIKE ANY com um parâmetro só", () => {
    const q = render(casaAlgumPadrao(COLUNAS_DO_CTE.tipoDocumento, ["%a%", "%b%"]));
    expect(q.sql).toContain("ilike any($1::text[])");
    expect(q.params).toEqual([["%a%", "%b%"]]);
  });
});
