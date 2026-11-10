import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/filtros-na-url";
import { temFiltro } from "@/hooks/filtros-na-url";

import { esquemaDaBusca, etiquetasDaBusca, filtrosDaBusca, NAO_SAO_FILTRO } from "./busca";

const ler = (b: Record<string, unknown>) => lerFiltros(esquemaDaBusca, b);

describe("busca de /comprovantes", () => {
  it("status do card não é filtro; intervalo de datas é", () => {
    const b = ler({ status: "pendentes", page: 3 });
    expect(temFiltro(["status", "page"], b.periodo, NAO_SAO_FILTRO)).toBe(false);
    expect(temFiltro(["filiais"], ler({ filiais: "RIO" }).periodo, NAO_SAO_FILTRO)).toBe(true);
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

  it("pagador aparece pelo nome quando as opções chegaram", () => {
    const b = ler({ pagadores: ["123"] });
    expect(etiquetasDaBusca(b).map((e) => e.valor)).toEqual(["123"]);
    expect(etiquetasDaBusca(b, ["NATURA"]).map((e) => e.valor)).toEqual(["NATURA"]);
  });
});
