import { describe, expect, it } from "vitest";

import { montarGradeDoMes, porData } from "./rules";

describe("montarGradeDoMes", () => {
  it("42 dias começando no domingo, marcando os de fora do mês", () => {
    const grade = montarGradeDoMes(2026, 10); // novembro/2026 começa num domingo
    expect(grade).toHaveLength(42);
    expect(grade[0]).toEqual({ iso: "2026-11-01", dia: 1, outroMes: false });
    expect(grade.at(-1)).toEqual({ iso: "2026-12-12", dia: 12, outroMes: true });
  });

  it("mês que começa no meio da semana puxa o fim do mês anterior", () => {
    const grade = montarGradeDoMes(2026, 0); // 01/01/2026 é quinta
    expect(grade.slice(0, 5).map((d) => d.iso)).toEqual([
      "2025-12-28",
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
    ]);
    expect(grade[3]?.outroMes).toBe(true);
  });
});

describe("porData", () => {
  it("agrupa por data", () => {
    const mapa = porData([
      { data: "2026-11-15", n: 1 },
      { data: "2026-11-15", n: 2 },
      { data: "2026-11-20", n: 3 },
    ]);
    expect(mapa.get("2026-11-15")?.map((f) => f.n)).toEqual([1, 2]);
  });
});
