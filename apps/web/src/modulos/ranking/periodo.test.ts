import { describe, expect, it } from "vitest";

import { mesAnterior, periodoDoMes } from "./periodo";

describe("períodos do ranking", () => {
  it("mês inteiro e mês anterior", () => {
    expect(periodoDoMes("2026-02")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(mesAnterior(new Date(2026, 0, 15))).toEqual({ inicio: "2025-12-01", fim: "2025-12-31" });
  });
});
