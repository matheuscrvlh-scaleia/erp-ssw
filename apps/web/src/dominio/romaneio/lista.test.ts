import { describe, expect, it } from "vitest";

import { CADASTRO_FR, fato } from "../testes/romaneio";
import { type FatoDaLista, ordenarLista, paginaDaLista, resumirLista } from "./lista";
import { analisarCte } from "./situacao";

function item(extra: Partial<FatoDaLista> = {}) {
  const f: FatoDaLista = {
    ...fato(),
    numeroNf: null,
    dataEmbarque: null,
    parceiroId: null,
    parceiroNome: null,
    unidadeId: null,
    filial: null,
    remetente: null,
    ufDestino: "SP",
    setor: null,
    statusAtual: null,
    ...extra,
  };
  const ctx = {
    cadastro: CADASTRO_FR,
    codigosPrejuizo: [13],
    periodo: { inicio: "2026-10-01", fim: "2026-10-31" },
    campo: "emissao" as const,
  };
  return { fato: f, analise: analisarCte(f, ctx) };
}

describe("lista do Romaneio", () => {
  it("ordem pela coluna com nulos no fim nos dois sentidos; desempate pelo id", () => {
    const a = item({ id: "a", peso: 5 });
    const b = item({ id: "b", parceiroNome: "Ágil" });
    const c = item({ id: "c", parceiroNome: "beta" });
    const d = item({ id: "d", parceiroNome: "Ágil" });
    const ids = (o: "asc" | "desc") =>
      ordenarLista([a, b, c, d], "parceiro", o).map((i) => i.fato.id);
    expect(ids("asc")).toEqual(["b", "d", "c", "a"]);
    expect(ids("desc")).toEqual(["c", "b", "d", "a"]);
  });

  it("sem coluna: previsão crescente, sem previsão no fim", () => {
    const x = item({ id: "x", dataPrevista: "2026-10-30" });
    const y = item({ id: "y", dataPrevista: null });
    const z = item({ id: "z", dataPrevista: "2026-10-28" });
    expect(ordenarLista([x, y, z], undefined, "desc").map((i) => i.fato.id)).toEqual([
      "z",
      "x",
      "y",
    ]);
  });

  it("totais e subtotais de todos os filtrados, frete em centavos, grupo maior primeiro", () => {
    const itens = [
      item({ setor: "B", valorFrete: 0.1, ocorrEfetivaCodigo: "1" }),
      item({ setor: "A", valorFrete: 0.2 }),
      item({ setor: "B", valorFrete: 0.2 }),
    ];
    const r = resumirLista(itens, "setor");
    expect(r.totais).toMatchObject({ ctes: 3, frete: 0.5, entregues: 1 });
    expect(r.grupos.map((g) => [g.rotulo, g.ctes, g.frete])).toEqual([
      ["B", 2, 0.3],
      ["A", 1, 0.2],
    ]);
    expect(resumirLista(itens, "none").grupos).toEqual([]);
  });

  it("página pedida; agrupado vem sem paginação", () => {
    const itens = ["1", "2", "3"].map((id) => item({ id }));
    const pedido = { ordem: undefined, direcao: "asc" as const, pagina: 2, tamanho: 2 };
    expect(paginaDaLista(itens, { ...pedido, agrupar: "none" }).map((i) => i.fato.id)).toEqual([
      "3",
    ]);
    expect(paginaDaLista(itens, { ...pedido, agrupar: "setor" })).toHaveLength(3);
  });
});
