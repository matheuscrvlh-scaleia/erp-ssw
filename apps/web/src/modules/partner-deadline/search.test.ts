import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/url-filters";

import { esquemaDetalhe, esquemaPrazo, filtrosDaBusca } from "./search";

const intervalo = { inicio: "2026-10-12", fim: "2026-11-10" };

describe("URL do Prazo do parceiro", () => {
  it("padrões de hoje: 30 dias, só nascidos em atraso, 50 por página", () => {
    expect(lerFiltros(esquemaPrazo, {})).toMatchObject({
      periodo: "30d",
      filtro: "nascidos",
      page: 1,
      size: 50,
    });
  });

  it("período fora dos atalhos volta para 30 dias; o detalhe guarda unidades e tipos", () => {
    expect(lerFiltros(esquemaDetalhe, { periodo: "ano", tipos: ["CTE"] })).toEqual({
      periodo: "30d",
      unidades: [],
      tipos: ["CTE"],
    });
  });
});

describe("filtrosDaBusca", () => {
  it("só leva as listas preenchidas", () => {
    expect(filtrosDaBusca({ unidades: [], parceiros: [], tipos: [] }, intervalo)).toEqual(
      intervalo,
    );
    expect(filtrosDaBusca({ unidades: ["u1"], tipos: ["CTE"] }, intervalo)).toEqual({
      ...intervalo,
      unidades: ["u1"],
      tipos: ["CTE"],
    });
  });
});
