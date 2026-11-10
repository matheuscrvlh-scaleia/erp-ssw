import { describe, expect, it } from "vitest";

import { mesAnterior, periodoDoMes, resolverPeriodo } from "./periodo";

const HOJE = new Date(2026, 10, 10, 22, 30); // 10/11 às 22h30 no navegador

describe("períodos do ranking", () => {
  it("atalhos contam pelo dia do navegador (22h30 ainda é dia 10)", () => {
    expect(resolverPeriodo("hoje", HOJE)).toEqual({
      inicio: "2026-11-10",
      fim: "2026-11-10",
      rotulo: "Hoje",
    });
    expect(resolverPeriodo("7d", HOJE).inicio).toBe("2026-11-04");
    expect(resolverPeriodo("30d", HOJE).inicio).toBe("2026-10-12");
    expect(resolverPeriodo("mes", HOJE)).toMatchObject({
      inicio: "2026-11-01",
      rotulo: "Este mês",
    });
    expect(resolverPeriodo("custom", HOJE, "2026-01-01", "2026-01-31").rotulo).toBe(
      "2026-01-01 → 2026-01-31",
    );
  });

  it("mês inteiro e mês anterior", () => {
    expect(periodoDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(mesAnterior(new Date(2026, 0, 15))).toEqual({ inicio: "2025-12-01", fim: "2025-12-31" });
  });
});
