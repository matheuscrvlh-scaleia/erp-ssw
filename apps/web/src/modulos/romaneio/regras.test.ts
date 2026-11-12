import { type LinhaDoDia } from "@erp/shared/contratos/romaneio";
import { describe, expect, it } from "vitest";

import {
  ajudantesDa,
  alternarLinha,
  alternarTodas,
  entradaDaHoje,
  estadoDoCabecalho,
  estaMarcada,
  FILTROS_DA_HOJE_VAZIOS,
  larguraBairros,
  pctDe,
  pctPrejudicada,
  proximaOrdem,
  quantasMarcadas,
  selecaoInicial,
} from "./regras";

describe("seleção para exportar", () => {
  it("começa com tudo marcado; desmarcar uma tira só ela", () => {
    const s = alternarLinha(selecaoInicial("f"), "a");
    expect(estaMarcada(s, "a")).toBe(false);
    expect(estaMarcada(s, "b")).toBe(true);
    expect(quantasMarcadas(s, 10)).toBe(9);
    expect(estadoDoCabecalho(s)).toBe("indeterminate");
  });

  it("a caixa do cabeçalho desmarca a lista inteira e depois marca uma a uma", () => {
    const nenhuma = alternarTodas(selecaoInicial("f"));
    expect(estadoDoCabecalho(nenhuma)).toBe(false);
    expect(quantasMarcadas(nenhuma, 10)).toBe(0);
    const uma = alternarLinha(nenhuma, "a");
    expect(estaMarcada(uma, "a")).toBe(true);
    expect(quantasMarcadas(uma, 10)).toBe(1);
    expect(alternarTodas(uma).modo).toBe("todas");
  });
});

describe("ordenação por coluna", () => {
  it("mesma coluna inverte; outra começa crescente", () => {
    expect(proximaOrdem({ ordem: "peso", dir: "asc" }, "peso")).toEqual({
      ordem: "peso",
      dir: "desc",
    });
    expect(proximaOrdem({ ordem: "peso", dir: "desc" }, "volumes")).toEqual({
      ordem: "volumes",
      dir: "asc",
    });
    expect(proximaOrdem({ dir: "asc" }, "peso")).toEqual({ ordem: "peso", dir: "asc" });
  });
});

describe("percentuais", () => {
  it("pctDe devolve null sem base", () => {
    expect(pctDe(2, 709)).toBeCloseTo(0.282, 3);
    expect(pctDe(1, 0)).toBeNull();
  });

  it("pctPrejudicada é zero sem romaneados", () => {
    expect(pctPrejudicada({ romaneados: 200, prejudicadas: 5 })).toBe(2.5);
    expect(pctPrejudicada({ romaneados: 0, prejudicadas: 0 })).toBe(0);
  });
});

describe("aba Hoje", () => {
  it("a entrada só leva os filtros preenchidos", () => {
    expect(entradaDaHoje(FILTROS_DA_HOJE_VAZIOS)).toEqual({});
    expect(entradaDaHoje({ filiais: ["CAS"], tipos: [] })).toEqual({ filiais: ["CAS"] });
  });

  it("coluna de bairros entre 18ch e 60ch, para caber em 3 linhas", () => {
    expect(larguraBairros([null, "CENTRO"])).toBe("18ch");
    expect(larguraBairros(["x".repeat(90)])).toBe("34ch");
    expect(larguraBairros(["x".repeat(500)])).toBe("60ch");
  });

  it("ajudantes do romaneio sem os vazios", () => {
    const l = { ajudante: "PEDRO", ajudante2: null, ajudante3: "PAULO" } as LinhaDoDia;
    expect(ajudantesDa(l)).toEqual(["PEDRO", "PAULO"]);
  });
});
