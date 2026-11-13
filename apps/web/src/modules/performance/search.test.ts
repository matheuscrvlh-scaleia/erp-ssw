import { describe, expect, it } from "vitest";

import { enderecoDaLista, limparFiltros, validarBusca } from "./search";

describe("busca da URL", () => {
  it("data impossível (2026-02-30) e código numérico do link", () => {
    const b = validarBusca({
      periodo: "custom",
      de: "2026-02-30",
      ate: "2026-03-01",
      codigos: [13],
    });
    expect(b.de).toBe("");
    expect(b.ate).toBe("2026-03-01");
    expect(b.codigos).toEqual(["13"]);
  });

  it("mesmos padrões de hoje e valor solto vira lista", () => {
    expect(
      validarBusca({ periodo: "x", unidades: "ARA", de: "10/11/2026", ordem: "melhor" }),
    ).toEqual({
      periodo: "mes",
      base: "emissao",
      unidades: ["ARA"],
      parceiros: [],
      ordem: "melhor",
      remetente: "",
      destino: "",
      filiais: [],
      codigos: [],
      tipos: [],
      de: "",
      ate: "",
    });
  });

  it("limpar mantém unidades e parceiros e tira o intervalo livre", () => {
    const b = validarBusca({
      periodo: "custom",
      de: "2026-11-01",
      ate: "2026-11-05",
      unidades: ["u1"],
      codigos: ["13"],
    });
    expect(limparFiltros(b)).toMatchObject({
      periodo: "mes",
      de: "",
      ate: "",
      codigos: [],
      unidades: ["u1"],
    });
  });

  it("endereço da lista leva os filtros da tela; códigos como número; vazios fora", () => {
    const b = validarBusca({
      periodo: "7d",
      base: "prevista",
      codigos: ["13", "x"],
      filiais: ["ARA"],
    });
    const href = enderecoDaLista(b, "previstos_por_faixa", {
      faixaPrev: "d1",
      ignorarPeriodo: true,
      base: "emissao",
    });
    expect(href.startsWith("/performance/lista?")).toBe(true);
    const q = new URLSearchParams(href.split("?")[1]);
    expect(q.get("tipo")).toBe("previstos_por_faixa");
    expect(q.get("faixa_prev")).toBe("d1");
    expect(q.get("ignorar_periodo")).toBe('"1"'); // o roteador guarda "1" como texto JSON, como hoje
    expect(q.get("base")).toBe("emissao");
    expect(q.get("codigos")).toBe("[13]");
    expect(q.has("remetente")).toBe(false);
    expect(q.has("parceiros")).toBe(false);
  });
});
