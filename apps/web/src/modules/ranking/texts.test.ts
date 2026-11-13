import { describe, expect, it } from "vitest";

import { escopoDaSerie } from "./texts";

describe("escopo do gráfico mês a mês", () => {
  const sem = { nomesParceiros: [], destino: "", remetente: "", filiais: [], tipos: [] };
  it("todos os parceiros, um nome ou N parceiros, mais os outros filtros", () => {
    expect(escopoDaSerie(sem)).toBe("todos os parceiros");
    expect(escopoDaSerie({ ...sem, nomesParceiros: ["Zeta Ltda"] })).toBe("Zeta Ltda");
    expect(
      escopoDaSerie({
        nomesParceiros: ["Zeta Ltda", "Água Limpa"],
        destino: " SP ",
        remetente: "a|b",
        filiais: ["CAP", "SOR"],
        tipos: ["CTE", "sem tipo"],
      }),
    ).toBe("2 parceiros · destino SP · remetente a|b · filiais CAP, SOR · tipo CTE, sem tipo");
  });
});
