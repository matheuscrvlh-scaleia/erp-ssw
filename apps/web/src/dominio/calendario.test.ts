import { describe, expect, it } from "vitest";

import {
  anosAte,
  chaveDoFeriado,
  contarPorTipo,
  datasDaRecorrencia,
  domingoDePascoa,
  feriadosNacionaisDoAno,
  normalizarLocal,
  unidadesImpactadas,
} from "./calendario";

describe("Páscoa e feriados nacionais", () => {
  it("Páscoa em anos conhecidos", () => {
    expect(domingoDePascoa(2024)).toBe("2024-03-31");
    expect(domingoDePascoa(2025)).toBe("2025-04-20");
    expect(domingoDePascoa(2026)).toBe("2026-04-05");
    expect(domingoDePascoa(2038)).toBe("2038-04-25");
  });

  it("13 feriados com Carnaval, Sexta Santa e Corpus Christi relativos à Páscoa", () => {
    const feriados = feriadosNacionaisDoAno(2026);
    expect(feriados).toHaveLength(13);
    const data = (inicio: string) => feriados.find((f) => f.descricao.startsWith(inicio))?.data;
    expect(data("Carnaval (segunda)")).toBe("2026-02-16");
    expect(data("Carnaval (terça)")).toBe("2026-02-17");
    expect(data("Sexta-feira Santa")).toBe("2026-04-03");
    expect(data("Corpus Christi")).toBe("2026-06-04");
    expect(data("Consciência Negra")).toBe("2026-11-20");
  });

  it("anos a gerar inclui o próprio", () => {
    expect(anosAte(2026, 4)).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(anosAte(2026, 0)).toEqual([2026]);
  });
});

describe("recorrência", () => {
  it("gera a data e os anos seguintes", () => {
    expect(datasDaRecorrencia("2026-08-15", 2)).toEqual(["2026-08-15", "2027-08-15", "2028-08-15"]);
    expect(datasDaRecorrencia("2026-08-15", 0)).toEqual(["2026-08-15"]);
  });
});

describe("local do feriado", () => {
  it("municipal exige cidade e UF; estadual exige UF", () => {
    expect(() => normalizarLocal("municipal", "  ", "SP")).toThrow(
      "Cidade e UF são obrigatórios para feriado municipal",
    );
    expect(() => normalizarLocal("estadual", null, null)).toThrow(
      "UF é obrigatório para feriado estadual",
    );
  });

  it("limpa o que não se aplica ao tipo", () => {
    expect(normalizarLocal("municipal", " Campinas ", "SP")).toEqual({
      cidade: "Campinas",
      uf: "SP",
    });
    expect(normalizarLocal("estadual", "Campinas", "SP")).toEqual({ cidade: null, uf: "SP" });
    expect(normalizarLocal("nacional", "Campinas", "SP")).toEqual({ cidade: null, uf: null });
  });

  it("chave e contagem", () => {
    expect(chaveDoFeriado({ data: "2026-01-01", tipo: "nacional", cidade: null, uf: null })).toBe(
      "2026-01-01|nacional||",
    );
    expect(
      contarPorTipo([{ tipo: "nacional" }, { tipo: "municipal" }, { tipo: "nacional" }]),
    ).toEqual({ nacional: 2, estadual: 0, municipal: 1 });
  });
});

describe("unidades impactadas", () => {
  const unidades = [
    { nome: "Campinas", cidade: "Campinas", uf: "SP" },
    { nome: "Santos", cidade: "Santos", uf: "SP" },
    { nome: "Rio", cidade: "Rio de Janeiro", uf: "RJ" },
  ];
  const nomes = (lista: { nome: string }[]) => lista.map((u) => u.nome);

  it("nacional pega todas; estadual a UF; municipal a cidade sem caixa", () => {
    expect(unidadesImpactadas({ tipo: "nacional", cidade: null, uf: null }, unidades)).toHaveLength(
      3,
    );
    expect(
      nomes(unidadesImpactadas({ tipo: "estadual", cidade: null, uf: "SP" }, unidades)),
    ).toEqual(["Campinas", "Santos"]);
    expect(
      nomes(unidadesImpactadas({ tipo: "municipal", cidade: "campinas", uf: "SP" }, unidades)),
    ).toEqual(["Campinas"]);
  });
});
