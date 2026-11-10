import { describe, expect, it } from "vitest";

import { nomesDosPagadores, siglasDoSeletor } from "./regras";

const opcoes = [
  { id: "11222333000181", nome: "Zeta Ltda", cnpjFormatado: "11.222.333/0001-81" },
  { id: "44555666000199", nome: "Água Limpa", cnpjFormatado: "44.555.666/0001-99" },
];

describe("filtros — regras dos seletores", () => {
  it("nomes dos parceiros marcados; CNPJ fora do período aparece como CNPJ", () => {
    expect(nomesDosPagadores(opcoes, ["44555666000199", "99999999000100"])).toEqual([
      "Água Limpa",
      "99999999000100",
    ]);
  });

  it("unidade marcada continua no seletor só se for filial própria", () => {
    expect(siglasDoSeletor(["MAO"], ["cap", "XYZ"], ["CAP", "MAO"])).toEqual(["CAP", "MAO"]);
  });
});
