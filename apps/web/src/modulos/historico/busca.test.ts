import { describe, expect, it } from "vitest";

import { lerFiltros } from "@/hooks/filtros-na-url";

import { esquemaDaBusca, etiquetasDaBusca } from "./busca";

const UNIDADE = "22222222-2222-4222-8222-222222222222";
const nomes = {
  unidade: (id: string) => (id === UNIDADE ? "Campinas" : undefined),
  autor: () => undefined,
};

describe("busca do Histórico", () => {
  it("padrões e tipos inválidos descartados", () => {
    const b = lerFiltros(esquemaDaBusca, { tipos: ["clima", "xyz"] });
    expect(b.periodo).toBe("30d");
    expect(b.visao).toBe("timeline");
    expect(b.presenca).toBe("todos");
    expect(b.tipos).toEqual(["clima"]);
  });

  it("sem filtro, sem etiquetas", () => {
    expect(etiquetasDaBusca(lerFiltros(esquemaDaBusca, {}), nomes)).toEqual([]);
  });

  it("etiquetas do que filtra, cada uma limpando o seu", () => {
    const b = lerFiltros(esquemaDaBusca, {
      unidades: [UNIDADE, "33333333-3333-4333-8333-333333333333"],
      presenca: "ambos",
      autor: "x",
      q: " chuva ",
    });
    expect(etiquetasDaBusca(b, nomes)).toEqual([
      { rotulo: "Unidades", valor: "2 selecionadas", limpar: { unidades: [] } },
      { rotulo: "Dias", valor: "Com ambos", limpar: { presenca: "todos" } },
      { rotulo: "Autor", valor: "autor sem nome", limpar: { autor: "" } },
      { rotulo: "Busca", valor: "chuva", limpar: { q: "" } },
    ]);
  });
});
