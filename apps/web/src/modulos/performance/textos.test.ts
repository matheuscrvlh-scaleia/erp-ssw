import { describe, expect, it } from "vitest";

import { corDoStatus, dataBr, etiquetasDoRelatorio, type FiltrosDoRelatorio } from "./textos";

const semFiltro: FiltrosDoRelatorio = {
  unidades: [],
  parceiros: [],
  remetente: "",
  destino: "",
  filiais: [],
  codigos: [],
};

const filtros: FiltrosDoRelatorio = {
  unidades: ["Campinas", "Jundiaí", "Sorocaba", "Santos"],
  parceiros: ["ACME"],
  remetente: "a||b",
  destino: "",
  filiais: ["CAP"],
  codigos: ["25", "69"],
};

describe("etiquetas dos filtros do relatório", () => {
  it("etiquetas como hoje: até 3 e '+N', remetente lido, códigos como Ocorrências", () => {
    expect(etiquetasDoRelatorio(filtros)).toEqual([
      { rotulo: "Unidades", valor: "Campinas, Jundiaí, Sorocaba +1" },
      { rotulo: "Parceiros", valor: "ACME" },
      { rotulo: "Remetente", valor: "a · b" },
      { rotulo: "Filiais", valor: "CAP" },
      { rotulo: "Ocorrências", valor: "25, 69" },
    ]);
    expect(etiquetasDoRelatorio(semFiltro)).toEqual([]);
  });
});

describe("formatação de exibição", () => {
  it("data do relatório em DD/MM/AAAA", () => {
    expect(dataBr("2026-11-05")).toBe("05/11/2026");
  });

  it("cor de cada status pelos tokens do tema", () => {
    expect(corDoStatus).toEqual({
      bom: "var(--status-good)",
      alerta: "var(--status-warn)",
      ruim: "var(--status-bad)",
    });
  });
});
