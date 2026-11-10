import { describe, expect, it } from "vitest";

import { filtrarPagadores, nomesDosPagadores, siglasDoSeletor } from "./regras";

const opcoes = [
  { id: "11222333000181", nome: "Zeta Ltda", cnpjFormatado: "11.222.333/0001-81" },
  { id: "44555666000199", nome: "Água Limpa", cnpjFormatado: "44.555.666/0001-99" },
];

describe("filtros — regras dos seletores", () => {
  it("pagadores em ordem alfabética sem acento, busca por nome ou CNPJ", () => {
    expect(filtrarPagadores(opcoes, "").map((o) => o.nome)).toEqual(["Água Limpa", "Zeta Ltda"]);
    expect(filtrarPagadores(opcoes, "agua").map((o) => o.nome)).toEqual(["Água Limpa"]);
    expect(filtrarPagadores(opcoes, "11.222").map((o) => o.nome)).toEqual(["Zeta Ltda"]);
    expect(filtrarPagadores(opcoes, "445556").map((o) => o.nome)).toEqual(["Água Limpa"]);
  });

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
