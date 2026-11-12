import {
  type EmpresaNoPainel,
  type PainelPlataforma,
} from "@erp/shared/contratos/painel-plataforma";
import { describe, expect, it } from "vitest";

import { ctesNoMes, emOperacao, serieDoCrescimento, serieDosCtes, variacao } from "./regras";

const empresa = (mudanca: Partial<EmpresaNoPainel>) =>
  ({ status: "ativa", ctesPorMes: null, ...mudanca }) as EmpresaNoPainel;

describe("emOperacao", () => {
  it("ativa e em implantação contam; suspensa e encerrada não", () => {
    expect(emOperacao(empresa({ status: "ativa" }))).toBe(true);
    expect(emOperacao(empresa({ status: "implantacao" }))).toBe(true);
    expect(emOperacao(empresa({ status: "suspensa" }))).toBe(false);
    expect(emOperacao(empresa({ status: "encerrada" }))).toBe(false);
  });
});

describe("ctesNoMes e variacao", () => {
  it("mês corrente e crescimento do último mês fechado", () => {
    const e = empresa({ ctesPorMes: [80, 100, 120, 30] });
    expect(ctesNoMes(e)).toBe(30);
    expect(variacao(e)).toBeCloseTo(0.2);
  });

  it("sem a contagem, nulo", () => {
    expect(ctesNoMes(empresa({}))).toBeNull();
    expect(variacao(empresa({}))).toBeNull();
  });
});

describe("séries dos gráficos", () => {
  const painel = {
    meses: ["2026-10", "2026-11"],
    crescimento: [
      { mes: "2026-10", novas: 1, total: 3 },
      { mes: "2026-11", novas: 2, total: 5 },
    ],
    totais: { ctesPorMes: [1200] },
  } as unknown as PainelPlataforma;

  it("crescimento separa as que já estavam das novas", () => {
    expect(serieDoCrescimento(painel)).toEqual([
      { rotulo: "out/26", existentes: 2, novas: 1 },
      { rotulo: "nov/26", existentes: 3, novas: 2 },
    ]);
  });

  it("CT-e por mês, zero onde falta o número", () => {
    expect(serieDosCtes(painel)).toEqual([
      { rotulo: "out/26", ctes: 1200 },
      { rotulo: "nov/26", ctes: 0 },
    ]);
  });

  it("sem o painel, séries vazias", () => {
    expect(serieDoCrescimento(undefined)).toEqual([]);
    expect(serieDosCtes(undefined)).toEqual([]);
  });
});
