import { describe, expect, it } from "vitest";

import { lerBuscaDaLista } from "./busca";
import { etiquetasDaLista, nomesDasUnidades, selo, textoDaFaixa } from "./textos";

describe("selo do atraso", () => {
  it.each([
    [null, false, null],
    [3, false, { texto: "Atrasado 3 dias", tom: "ruim_forte" }],
    [1, true, { texto: "Atrasado 1 dia", tom: "ruim", dica: "Entregue com atraso" }],
    [0, false, { texto: "Vence hoje", tom: "atencao" }],
    [0, true, { texto: "No prazo", tom: "bom" }],
    [-2, false, { texto: "No prazo", tom: "bom" }],
  ] as const)("atraso %s, entregue %s", (atraso, entregue, esperado) => {
    expect(selo(atraso, entregue)).toEqual(esperado);
  });
});

describe("textos das etiquetas", () => {
  it("faixa de peso/atraso", () => {
    expect(textoDaFaixa(10, 2000, "kg")).toBe("10 a 2.000 kg");
    expect(textoDaFaixa(3, null, "dias")).toBe("a partir de 3 dias");
    expect(textoDaFaixa(null, 5, "dias")).toBe("até 5 dias");
    expect(textoDaFaixa(null, null, "kg")).toBe("");
  });
});

describe("etiquetas Filtrando por", () => {
  it('unidade por id vira "unidade selecionada"', () => {
    expect(nomesDasUnidades(["CAP", "8f1d2c3b-0000-4000-8000-000000000001"])).toEqual([
      "CAP",
      "unidade selecionada",
    ]);
  });

  it("valores, o que cada uma limpa e a unidade que some em Penalizados", () => {
    const busca = lerBuscaDaLista({
      tipo: "penalizados",
      unidades: ["MAO"],
      codigos: [35, 99],
      peso_min: 10,
      ctrc: " 123 ",
    });
    const etiquetas = etiquetasDaLista(
      busca,
      ["penalizados"],
      [],
      [{ codigo: 35, descricao: "AGENDAMENTO" }],
    );
    const por = (rotulo: string) => etiquetas.find((e) => e.rotulo === rotulo);
    expect(por("CTRC")).toEqual({ rotulo: "CTRC", valor: "123", limpar: { ctrc: "" } });
    expect(por("Unidade")?.valor).toBe("");
    expect(por("Ocorrência")?.valor).toBe("35 — AGENDAMENTO · 99");
    expect(por("Peso")).toEqual({
      rotulo: "Peso",
      valor: "a partir de 10 kg",
      limpar: { peso_min: null, peso_max: null },
    });
    expect(
      etiquetasDaLista(busca, ["atrasados"], [], []).find((e) => e.rotulo === "Unidade")?.valor,
    ).toBe("MAO");
  });
});
