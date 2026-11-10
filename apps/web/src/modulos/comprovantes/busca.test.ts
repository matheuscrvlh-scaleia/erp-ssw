import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/filtros-na-url";

import { esquemaDaBusca, etiquetasDaBusca, filtrosDaBusca, temFiltro } from "./busca";

const ler = (b: Record<string, unknown>) => lerFiltros(esquemaDaBusca, b);

describe("busca de /comprovantes", () => {
  it("status do card não é filtro; intervalo de datas é", () => {
    const b = ler({ status: "pendentes", page: 3 });
    expect(temFiltro(["status", "page"], b)).toBe(false);
    expect(temFiltro(["filiais"], ler({ filiais: "RIO" }))).toBe(true);
  });

  it("monta os filtros da API e as etiquetas", () => {
    const b = ler({ filiais: "RIO", unidades: ["CAS", "SPO"], remetente: "a|b", nf: 12 });
    expect(filtrosDaBusca(b, { inicio: "2026-11-01", fim: "2026-11-10" })).toMatchObject({
      filiais: ["RIO"],
      nf: "12",
      inicio: "2026-11-01",
    });
    expect(etiquetasDaBusca(b).map((e) => [e.rotulo, e.valor])).toEqual([
      ["Unidade responsável", "RIO"],
      ["Unidades", "2 selecionadas"],
      ["Remetente", "a · b"],
      ["Nota fiscal", "12"],
    ]);
  });
});
