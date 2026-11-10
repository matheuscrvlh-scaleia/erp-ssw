import { describe, expect, it } from "vitest";

import { PARAMETROS_PADRAO, rascunhoDaRegra, rascunhoVazio, regraParaSalvar } from "./regras-tela";

const ID = "7d0c7f1e-2a8b-4c55-9b1a-0d5e6f7a8b9c";

describe("regraParaSalvar", () => {
  it("converte os parâmetros digitados em número, aceitando vírgula", () => {
    const d = {
      ...rascunhoVazio("2026-10-05"),
      nome: "Regra Q4",
      criterios: [
        { criterio: "entregas_prazo" as const, parametros: { peso: "2,5" } },
        { criterio: "livre" as const, parametros: { nome: " Bônus ", valor: "50" } },
      ],
    };
    const r = regraParaSalvar(d);
    expect(r).toEqual({
      ok: true,
      valor: {
        id: undefined,
        nome: "Regra Q4",
        descricao: null,
        vigenciaInicio: "2026-10-05",
        vigenciaFim: null,
        ativo: true,
        criterios: [
          { criterio: "entregas_prazo", parametros: { peso: 2.5 } },
          { criterio: "livre", parametros: { nome: "Bônus", valor: 50 } },
        ],
      },
    });
  });

  it("recusa parâmetro que não é número", () => {
    const d = {
      ...rascunhoVazio("2026-10-05"),
      nome: "X",
      criterios: [
        { criterio: "piso_performance" as const, parametros: { performance_minima: "" } },
      ],
    };
    expect(regraParaSalvar(d)).toEqual({
      ok: false,
      erro: 'Piso de performance: "performance_minima" precisa ser um número.',
    });
  });

  it("os padrões de cada critério já são válidos", () => {
    const d = {
      ...rascunhoVazio("2026-10-05"),
      nome: "Todos",
      criterios: Object.entries(PARAMETROS_PADRAO).map(([criterio, parametros]) => ({
        criterio: criterio as keyof typeof PARAMETROS_PADRAO,
        parametros,
      })),
    };
    expect(regraParaSalvar(d).ok).toBe(true);
  });
});

describe("rascunhoDaRegra", () => {
  it("leva números da regra salva para texto editável", () => {
    const d = rascunhoDaRegra({
      id: ID,
      nome: "R",
      descricao: null,
      vigenciaInicio: "2026-10-01",
      vigenciaFim: null,
      ativo: true,
      criterios: [{ id: ID, criterio: "penalizante", parametros: { valor: 15 }, ordem: 0 }],
    });
    expect(d.criterios).toEqual([{ criterio: "penalizante", parametros: { valor: "15" } }]);
    expect(d.vigenciaFim).toBe("");
  });
});
