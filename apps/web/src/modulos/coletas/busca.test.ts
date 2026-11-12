import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/filtros-na-url";
import { temFiltro } from "@/hooks/filtros-na-url";

import { esquemaDaBusca, etiquetasDaBusca, filtrosDaBusca } from "./busca";

const ler = (b: Record<string, unknown>) => lerFiltros(esquemaDaBusca, b);

describe("busca de /coletas", () => {
  it("padrão 30 dias; tipo vazio vira nulo na API; status inválido volta a todas", () => {
    const b = ler({ tipo: "", status: "xyz", unidades: "ARA" });
    expect(b).toMatchObject({ periodo: "30d", status: "todas", unidades: ["ARA"] });
    expect(filtrosDaBusca(b, { inicio: "2026-10-01", fim: "2026-10-31" }).tipo).toBeNull();
    expect(temFiltro(["periodo"], ler({ periodo: "7d" }).periodo)).toBe(false);
  });

  it("etiquetas (solicitante vazio = sem solicitante)", () => {
    const b = ler({ solicitantes: [""], tipo: "REVERSA", status: "vencidas" });
    expect(etiquetasDaBusca(b).map((e) => [e.rotulo, e.valor])).toEqual([
      ["Solicitante", "(sem solicitante)"],
      ["Tipo", "Reversa"],
      ["Situação", "Vencidas"],
    ]);
  });
});
