import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/filtros-na-url";

import { esquemaDetalhe, esquemaPrazo, filtrosDaBusca } from "./busca";
import { fmtPP, tomDoSla } from "./componentes";
import { opcoesDeTipo } from "./tipos";

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

describe("formatos", () => {
  it("diferença em pontos percentuais com sinal", () => {
    expect(fmtPP(0.023)).toBe("+2,3 pp");
    expect(fmtPP(-0.01)).toBe("-1,0 pp");
    expect(fmtPP(null)).toBe("—");
  });

  it("tom pela meta e pelo alerta do SLA", () => {
    const sla = { meta: 0.95, alerta: 0.9 };
    expect(tomDoSla(0.96, sla)).toBe("good");
    expect(tomDoSla(0.92, sla)).toBe("warn");
    expect(tomDoSla(0.8, sla)).toBe("bad");
  });

  it("tipo vazio aparece como 'sem tipo'", () => {
    expect(opcoesDeTipo(["CTE", "__SEM_TIPO__"])).toEqual([
      { valor: "CTE", rotulo: "CTE" },
      { valor: "__SEM_TIPO__", rotulo: "sem tipo" },
    ]);
  });
});
