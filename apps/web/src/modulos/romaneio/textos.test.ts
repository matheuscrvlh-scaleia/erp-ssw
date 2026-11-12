import { describe, expect, it } from "vitest";

import { baseAtual, cidadeUf, diasPorExtenso, ROTULO_RECORTE, textoDoPrejuizo } from "./textos";

describe("textos do Romaneio", () => {
  it("cidade/UF: só a cidade quando falta a UF; sem cidade, null", () => {
    expect(cidadeUf("SUMARE", "SP")).toBe("SUMARE/SP");
    expect(cidadeUf("SUMARE", null)).toBe("SUMARE");
    expect(cidadeUf(null, "SP")).toBeNull();
  });

  it("prejuízo: sem filtro de código vale o 13", () => {
    expect(textoDoPrejuizo(undefined)).toBe("código 13");
    expect(textoDoPrejuizo([])).toBe("código 13");
    expect(textoDoPrejuizo([13, 69])).toBe("códigos 13, 69");
  });

  it("dias por extenso no singular e no plural", () => {
    expect(diasPorExtenso(1)).toBe("1 dia");
    expect(diasPorExtenso(3)).toBe("3 dias");
  });

  it("base de data e recorte com os textos da tela", () => {
    expect(baseAtual("saida").curto).toBe("por data de saída para entrega");
    expect(ROTULO_RECORTE.devolvido).toBe("Baixado sem entrega");
  });
});
