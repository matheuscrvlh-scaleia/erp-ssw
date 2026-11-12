import { describe, expect, it } from "vitest";

import { diaPorExtenso, ROTULO_DA_PRESENCA, ROTULO_DO_PERIODO } from "./textos";

describe("textos do Histórico", () => {
  it("dia por extenso, sem depender do fuso da máquina", () => {
    expect(diaPorExtenso("2026-11-05")).toBe("quinta-feira, 05 de novembro");
  });

  it("rótulos do período e da presença", () => {
    expect(ROTULO_DO_PERIODO.mes).toBe("Mês");
    expect(ROTULO_DA_PRESENCA.anotacao).toBe("Só com anotação");
  });
});
