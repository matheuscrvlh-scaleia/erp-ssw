import { describe, expect, it } from "vitest";

import { filtroDaBusca, lerBuscaDaLista, periodoDaLista, tituloDaLista } from "./busca";

describe("lerBuscaDaLista", () => {
  it("URL vazia: padrões de hoje (emitidos, mês, por emissão, 1ª página)", () => {
    const b = lerBuscaDaLista({});
    expect(b).toMatchObject({
      tipo: "emitidos",
      periodo: "mes",
      base: "emissao",
      sort: "emissao",
      dir: "desc",
      page: 1,
      codigos: [],
      recortes: undefined,
      abertos: undefined,
    });
  });

  it("links antigos: valor solto vira lista, números como texto e lixo descartado", () => {
    const b = lerBuscaDaLista({
      tipo: "nao_existe",
      recortes: ["atrasados", "xxx"],
      codigos: "35",
      unidades: "CAP",
      faixa_min: "3.7",
      peso_max: "12.5",
      ignorar_periodo: "1",
      abertos: "true",
      de: "10/11/2026",
      page: "0",
      busca: 33214,
    });
    expect(b.tipo).toBe("emitidos");
    expect(b.recortes).toEqual(["atrasados"]);
    expect(b.codigos).toEqual([35]);
    expect(b.unidades).toEqual(["CAP"]);
    expect(b.faixa_min).toBe(3);
    expect(b.peso_max).toBe(12.5);
    expect(b.ignorar_periodo).toBe(true);
    expect(b.abertos).toBe(true);
    expect(b.de).toBe("");
    expect(b.page).toBe(1);
    expect(b.busca).toBe("33214");
  });
});

describe("periodoDaLista", () => {
  const hoje = "2026-11-10";
  const periodo = (p: string, de = "", ate = "") =>
    periodoDaLista(lerBuscaDaLista({ periodo: p, de, ate }), hoje);
  it("mês = do dia 1º até hoje (dia de Brasília vindo de fora)", () => {
    expect(periodo("mes")).toEqual({ inicio: "2026-11-01", fim: "2026-11-10", rotulo: "Este mês" });
  });
  it("7 dias contam hoje", () => {
    expect(periodo("7d").inicio).toBe("2026-11-04");
  });
  it("personalizado sem as duas datas cai no mês", () => {
    expect(periodo("custom", "2026-10-01").rotulo).toBe("Este mês");
    expect(periodo("custom", "2026-10-01", "2026-10-31")).toEqual({
      inicio: "2026-10-01",
      fim: "2026-10-31",
      rotulo: "2026-10-01 → 2026-10-31",
    });
  });
});

describe("filtroDaBusca", () => {
  const periodo = { inicio: "2026-11-01", fim: "2026-11-10" };

  it("só vai para a API o que tem valor", () => {
    const f = filtroDaBusca(lerBuscaDaLista({ remetente: "  ", codigos: ["1"] }), periodo);
    expect(f.remetente).toBeUndefined();
    expect(f.unidades).toBeUndefined();
    expect(f.codigos).toEqual([1]);
    expect(f.inicio).toBe("2026-11-01");
  });

  it("parâmetro de recorte só vale com o recorte marcado", () => {
    const sem = filtroDaBusca(lerBuscaDaLista({ codigo: "35", faixa_min: "3" }), periodo);
    expect(sem.codigoRecorte).toBeUndefined();
    expect(sem.faixaMin).toBeUndefined();
    const com = filtroDaBusca(
      lerBuscaDaLista({
        tipo: "por_codigo",
        recortes: "por_faixa_atraso",
        codigo: "35",
        faixa_min: "3",
      }),
      periodo,
    );
    expect(com.codigoRecorte).toBe(35);
    expect(com.faixaMin).toBe(3);
  });
});

describe("tituloDaLista", () => {
  it("recortes unidos por + e o '(FR)' vira o nome curto da empresa", () => {
    const b = lerBuscaDaLista({
      tipo: "em_atraso_fr",
      recortes: "por_faixa_atraso",
      faixa_min: "3",
    });
    expect(tituloDaLista(b, "Este mês", "ACME")).toBe(
      "Em atraso (ACME) + CT-e por faixa de atraso (3+ dias) — Este mês",
    );
  });

  it("recorte sem período ignorando o período: 'Todos em aberto'", () => {
    const b = lerBuscaDaLista({
      tipo: "previstos_por_faixa",
      faixa_prev: "d1",
      ignorar_periodo: "1",
    });
    expect(tituloDaLista(b, "Hoje", "ACME")).toBe(
      "Previstos — por vencimento · D+1 — Todos em aberto",
    );
  });

  it("penalizados de uma unidade levam a unidade no título", () => {
    const b = lerBuscaDaLista({ tipo: "penalizados", unidades: "CAP" });
    expect(tituloDaLista(b, "Hoje", "ACME")).toBe("CT-e penalizados em CAP — Hoje");
  });
});
