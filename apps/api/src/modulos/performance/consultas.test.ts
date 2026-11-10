import { type FiltroCtrc } from "@erp/dominio/performance/filtro";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { atraso, casaCodigos, ondeDoFiltro } from "./consultas";

const dialeto = new PgDialect();
const ctx = {
  empresaId: "e1",
  fuso: "America/Sao_Paulo",
  hoje: "2026-11-10",
  filiaisProprias: ["ARA", "CAP"],
};
const vazio: FiltroCtrc = {
  periodo: { inicio: "2026-11-01", fim: "2026-11-10" },
  baseData: "emissao",
  unidades: null,
  parceiros: null,
  filiais: null,
  remetente: null,
  destino: null,
  codigos: null,
  tipos: null,
};

describe("ondeDoFiltro", () => {
  it("sempre o universo da tela e o período pela base escolhida, tudo como parâmetro", () => {
    const q = dialeto.sqlToQuery(ondeDoFiltro({ ...vazio, baseData: "prevista" }, ctx));
    expect(q.sql).toBe(
      "c.empresa_id = $1 and not c.fora_universo and c.filial_efetiva = any($2::text[]) and c.data_prevista_entrega between $3::date and $4::date",
    );
    expect(q.params).toEqual(["e1", ["ARA", "CAP"], "2026-11-01", "2026-11-10"]);
  });

  it("só os filtros preenchidos; lista vazia continua no WHERE (nada casa)", () => {
    const q = dialeto.sqlToQuery(
      ondeDoFiltro(
        {
          ...vazio,
          unidades: ["u1"],
          parceiros: ["123"],
          filiais: [],
          remetente: ["%a%"],
          destino: ["%b%", "%c%"],
          codigos: [13],
          tipos: ["NORMAL"],
        },
        ctx,
      ),
    );
    expect(q.sql).toContain("c.unidade_id = any($5::uuid[])");
    expect(q.sql).toContain("c.pagador_cnpj_digitos = any($6::text[])");
    expect(q.sql).toContain("c.filial_efetiva = any($7::text[])");
    expect(q.sql).toContain("c.remetente ilike any($8::text[])");
    expect(q.sql).toContain("c.cidade_destino ilike any($9::text[])");
    expect(q.sql).toContain("c.ocorr_efetiva_codigo_num = any($10::int[])");
    expect(q.params).toContainEqual([]);
    expect(q.params).toContainEqual(["%b%", "%c%"]);
  });

  it("sem período, sem códigos e sem tipos quando a chamada pede", () => {
    const q = dialeto.sqlToQuery(
      ondeDoFiltro({ ...vazio, codigos: [1], tipos: ["X"] }, ctx, {
        semPeriodo: true,
        semCodigos: true,
        semTipos: true,
      }),
    );
    expect(q.sql).not.toContain("between");
    expect(q.sql).not.toContain("ocorr_efetiva_codigo_num");
    expect(q.sql).not.toContain("tipo_documento");
  });

  it("filtro de códigos como expressão para os alertas", () => {
    expect(dialeto.sqlToQuery(casaCodigos(vazio)).sql).toBe("true");
    expect(dialeto.sqlToQuery(casaCodigos({ ...vazio, codigos: [85] })).params).toEqual([[85]]);
  });

  it("atraso usa o hoje e o fuso da consulta (decisão Q11)", () => {
    const q = dialeto.sqlToQuery(atraso(ctx, [12]));
    expect(q.params).toEqual(["America/Sao_Paulo", [1, 18, 67], [12], "2026-11-10"]);
  });
});
