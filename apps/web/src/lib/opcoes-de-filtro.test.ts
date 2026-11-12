import { describe, expect, it } from "vitest";

import {
  agruparPagadoresPorNome,
  cnpjsDosGrupos,
  gruposMarcados,
  nomesDosPagadores,
  nomesDosPagadoresAgrupados,
  siglasDoSeletor,
  unirParceiros,
} from "./opcoes-de-filtro";

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

describe("filtros — Parceiros agrupados (matriz e filiais pelo nome)", () => {
  const comFiliais = [
    { id: "11222333000181", nome: "Zeta Ltda", cnpjFormatado: "11.222.333/0001-81" },
    { id: "11222333000262", nome: "ZETA  LTDA ", cnpjFormatado: "11.222.333/0002-62" },
    { id: "44555666000199", nome: "Água Limpa", cnpjFormatado: "44.555.666/0001-99" },
    { id: "77888999000155", nome: "agua limpa", cnpjFormatado: "77.888.999/0001-55" },
    { id: "12345678000100", nome: "Beta", cnpjFormatado: "12.345.678/0001-00" },
  ];
  const grupos = agruparPagadoresPorNome(comFiliais);

  it("um grupo por nome, sem acento/caixa/espaço, em ordem alfabética", () => {
    expect(grupos).toEqual([
      {
        valor: "44555666000199,77888999000155",
        nome: "Água Limpa",
        ids: ["44555666000199", "77888999000155"],
        cnpjFormatado: null,
      },
      {
        valor: "12345678000100",
        nome: "Beta",
        ids: ["12345678000100"],
        cnpjFormatado: "12.345.678/0001-00",
      },
      {
        valor: "11222333000181,11222333000262",
        nome: "Zeta Ltda",
        ids: ["11222333000181", "11222333000262"],
        cnpjFormatado: null,
      },
    ]);
  });

  it("marcar o nome marca todos os CNPJs; desmarcar tira o grupo inteiro", () => {
    const marcados = cnpjsDosGrupos(grupos, [], ["11222333000181,11222333000262"]);
    expect(marcados).toEqual(["11222333000181", "11222333000262"]);
    expect(gruposMarcados(grupos, marcados)).toEqual(["11222333000181,11222333000262"]);
    const comBeta = cnpjsDosGrupos(grupos, marcados, [
      "11222333000181,11222333000262",
      "12345678000100",
    ]);
    expect(comBeta).toEqual(["11222333000181", "11222333000262", "12345678000100"]);
    expect(cnpjsDosGrupos(grupos, comBeta, ["12345678000100"])).toEqual(["12345678000100"]);
  });

  it("CNPJ marcado que saiu do período continua marcado até desmarcar", () => {
    expect(gruposMarcados(grupos, ["99999999000100"])).toEqual(["99999999000100"]);
    expect(cnpjsDosGrupos(grupos, ["99999999000100"], ["99999999000100"])).toEqual([
      "99999999000100",
    ]);
    expect(cnpjsDosGrupos(grupos, ["99999999000100"], [])).toEqual([]);
  });

  it("etiqueta com o nome do grupo e união dos dois seletores sem repetir CNPJ", () => {
    expect(
      nomesDosPagadoresAgrupados(comFiliais, ["11222333000181", "11222333000262", "999"]),
    ).toEqual(["Zeta Ltda", "999"]);
    expect(nomesDosPagadoresAgrupados(comFiliais, [])).toEqual([]);
    // Seletor "Parceiros" (por CNPJ): matriz e filial de nome igual sem acento/caixa contam como
    // um, na ordem das opções (não alfabética), como hoje.
    expect(
      nomesDosPagadoresAgrupados(comFiliais, [
        "77888999000155",
        "11222333000262",
        "44555666000199",
        "11222333000181",
      ]),
    ).toEqual(["Zeta Ltda", "Água Limpa"]);
    expect(
      unirParceiros(["12345678000100", "11222333000181"], ["11222333000181", "11222333000262"]),
    ).toEqual(["11222333000181", "11222333000262", "12345678000100"]);
  });
});
