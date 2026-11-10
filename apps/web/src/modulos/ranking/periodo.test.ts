import { hojeNoFuso } from "@erp/shared/datas";
import { describe, expect, it } from "vitest";

import { mesAnterior, mesDe, periodoDoMes } from "./periodo";

describe("períodos do ranking", () => {
  it("mês inteiro e mês anterior", () => {
    expect(periodoDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(periodoDoMes("2024-02")).toEqual({ inicio: "2024-02-01", fim: "2024-02-29" });
    expect(periodoDoMes("2026-12")).toEqual({ inicio: "2026-12-01", fim: "2026-12-31" });
    expect(mesAnterior("2026-01-15")).toEqual({ inicio: "2025-12-01", fim: "2025-12-31" });
  });

  it("o mês é o do dia de Brasília, não o do relógio do navegador (Q11)", () => {
    // 01/11 01:00 UTC ainda é 31/10 em Brasília: o mês corrente é outubro.
    const hoje = hojeNoFuso("America/Sao_Paulo", new Date("2026-11-01T01:00:00Z"));
    expect(mesDe(hoje)).toBe("2026-10");
    expect(mesAnterior(hoje)).toEqual({ inicio: "2026-09-01", fim: "2026-09-30" });
  });
});
