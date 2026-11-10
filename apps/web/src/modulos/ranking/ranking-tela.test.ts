import { type LinhaDoRanking } from "@erp/shared/contratos/ranking";
import { describe, expect, it } from "vitest";

import {
  filtrarPorCard,
  formatarPct,
  kpisDoRanking,
  limiaresDoSla,
  nivelDoSla,
  ordenarLinhas,
} from "./ranking-tela";

function linha(chave: string, slaPct: number | null, entregue: number, foraTransp: number) {
  return {
    chave,
    rotulo: chave,
    sub: null,
    totalCtes: entregue + 1,
    entregue,
    noPrazo: entregue - foraTransp,
    foraPrazo: foraTransp,
    foraCliente: 0,
    foraTransp,
    slaPct,
    aEntregar: 1,
    atrasadas: 0,
    noPrazoAberto: 1,
    peso: 0,
    volumes: 0,
    frete: 0,
  } satisfies LinhaDoRanking;
}

const A = linha("A", 0.96, 100, 4);
const B = linha("B", 0.9, 50, 5);
const C = linha("C", null, 0, 0);

describe("ranking operacional — regras da tela", () => {
  it("cor do SLA: meta 95%, alerta 90%", () => {
    expect(nivelDoSla(0.95, 0.95, 0.9)).toBe("bom");
    expect(nivelDoSla(0.9, 0.95, 0.9)).toBe("alerta");
    expect(nivelDoSla(0.899, 0.95, 0.9)).toBe("ruim");
    expect(nivelDoSla(null, 0.95, 0.9)).toBeNull();
  });

  it("SLA médio é ponderado pelas entregas, não média dos percentuais", () => {
    const k = kpisDoRanking([A, B, C], 0.95);
    // (150 − 9) ÷ 150 = 0,94
    expect(k.slaMedio).toBeCloseTo(0.94, 10);
    expect(k).toMatchObject({ grupos: 3, totalCtes: 153, abaixoMeta: 1 });
  });

  it("cards filtram na meta / abaixo da meta, ignorando quem não tem SLA", () => {
    expect(filtrarPorCard([A, B, C], "na_meta", 0.95)).toEqual([A]);
    expect(filtrarPorCard([A, B, C], "abaixo_meta", 0.95)).toEqual([B]);
    expect(filtrarPorCard([A, B, C], "todos", 0.95)).toHaveLength(3);
  });

  it("nulos ficam por último nas duas direções", () => {
    const nome = (r: LinhaDoRanking) => r.rotulo ?? r.chave;
    expect(ordenarLinhas([C, B, A], "slaPct", "asc", nome).map((r) => r.chave)).toEqual([
      "B",
      "A",
      "C",
    ]);
    expect(ordenarLinhas([C, B, A], "slaPct", "desc", nome).map((r) => r.chave)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("percentual com vírgula e uma casa", () => {
    expect(formatarPct(0.9567)).toBe("95,7%");
    expect(formatarPct(null)).toBe("—");
  });

  it("meta e alerta vêm das configurações da empresa; sem elas, 95% e 90%", () => {
    expect(limiaresDoSla(undefined)).toEqual({ meta: 0.95, alerta: 0.9 });
    expect(limiaresDoSla({ sla_meta_pct: "97", sla_alerta_amarelo_pct: "92.5" })).toEqual({
      meta: 0.97,
      alerta: 0.925,
    });
    expect(limiaresDoSla({ sla_meta_pct: "x" }).meta).toBe(0.95);
  });
});
