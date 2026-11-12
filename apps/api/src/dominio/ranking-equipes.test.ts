import { describe, expect, it } from "vitest";

import {
  calcularBonificacaoDaEquipe,
  compararMembros,
  type CriterioDaRegra,
  posicaoDoNovoMembro,
  ranquearEquipes,
  regraVigente,
} from "./ranking-equipes";

const REGRA_DA_SPEC: CriterioDaRegra[] = [
  { criterio: "entregas_prazo", parametros: { peso: 2 } },
  { criterio: "penalizante", parametros: { valor: 15 } },
  { criterio: "meta_produtividade", parametros: { meta_entregas: 200, bonus_se_atingir: 200 } },
  { criterio: "piso_performance", parametros: { performance_minima: 85 } },
];

const TOTAIS = { totalEntregas: 120, entregasNoPrazo: 100, penalizantes: 6 };

describe("calcularBonificacaoDaEquipe", () => {
  it("exemplo da spec: 120 CT-e, 100 no prazo, 6 penalizantes, piso 85 passa (95% ≥ 85%)", () => {
    const r = calcularBonificacaoDaEquipe(TOTAIS, REGRA_DA_SPEC);
    expect(r.performance).toBeCloseTo(0.95, 10);
    expect(r.pontos).toBe(94);
    expect(r.zeradoPorPiso).toBe(false);
    expect(r.valorCalculado).toBe(110);
    expect(r.breakdown.map((b) => [b.label, b.detalhe, b.subtotal])).toEqual([
      ["Entregas no prazo", "100 × R$2", 200],
      ["Penalidades", "6 × -R$15", -90],
      ["Meta de produtividade", "Meta não atingida (120/200)", 0],
      ["Piso de performance", "Performance 95.0% ≥ piso", 0],
    ]);
  });

  it("piso acima da performance zera o valor", () => {
    const r = calcularBonificacaoDaEquipe(TOTAIS, [
      { criterio: "entregas_prazo", parametros: { peso: 2 } },
      { criterio: "piso_performance", parametros: { performance_minima: 96 } },
    ]);
    expect(r.zeradoPorPiso).toBe(true);
    expect(r.valorCalculado).toBe(0);
    expect(r.breakdown[1]?.detalhe).toBe("Performance 95.0% < piso 96%");
  });

  it("piso igual à performance passa", () => {
    const r = calcularBonificacaoDaEquipe(TOTAIS, [
      { criterio: "piso_performance", parametros: { performance_minima: 95 } },
    ]);
    expect(r.zeradoPorPiso).toBe(false);
  });

  it("meta atingida soma o bônus; livre usa o nome; valor nunca fica negativo", () => {
    const r = calcularBonificacaoDaEquipe(
      { totalEntregas: 200, entregasNoPrazo: 0, penalizantes: 20 },
      [
        {
          criterio: "meta_produtividade",
          parametros: { meta_entregas: 200, bonus_se_atingir: 50 },
        },
        { criterio: "livre", parametros: { nome: "Bônus pontual", valor: 50 } },
        { criterio: "penalizante", parametros: { valor: 15 } },
      ],
    );
    expect(r.breakdown[0]?.detalhe).toBe("Meta atingida (200/200)");
    expect(r.breakdown[1]?.detalhe).toBe("Bônus pontual");
    expect(r.valorCalculado).toBe(0);
  });

  it("sem CT-e: performance 1", () => {
    const r = calcularBonificacaoDaEquipe(
      { totalEntregas: 0, entregasNoPrazo: 0, penalizantes: 0 },
      [],
    );
    expect(r).toMatchObject({ performance: 1, valorCalculado: 0, breakdown: [] });
  });
});

describe("membros", () => {
  it("ajudante pega a primeira posição livre ou a pedida", () => {
    expect(posicaoDoNovoMembro("ajudante", [1, 3], null)).toBe(2);
    expect(posicaoDoNovoMembro("ajudante", [1], 3)).toBe(3);
    expect(posicaoDoNovoMembro("motorista", [1, 2, 3], null)).toBeNull();
  });

  it("recusa posição ocupada e o quarto ajudante", () => {
    expect(() => posicaoDoNovoMembro("ajudante", [2], 2)).toThrow(
      "Ajudante 2 já está ocupado nesta equipe.",
    );
    expect(() => posicaoDoNovoMembro("ajudante", [1, 2, 3], null)).toThrow(
      "Esta equipe já tem 3 ajudantes ativos.",
    );
  });

  it("ordena motorista primeiro, depois ajudantes pela posição", () => {
    const membros = [
      { papel: "ajudante" as const, posicao: 2, nome: "Ana" },
      { papel: "motorista" as const, posicao: null, nome: "Zé" },
      { papel: "ajudante" as const, posicao: 1, nome: "Bia" },
    ];
    expect([...membros].sort(compararMembros).map((m) => m.nome)).toEqual(["Zé", "Bia", "Ana"]);
  });
});

describe("regraVigente e ranquearEquipes", () => {
  const regras = [
    { id: "antiga", ativo: true, vigenciaInicio: "2026-01-01", vigenciaFim: null },
    { id: "nova", ativo: true, vigenciaInicio: "2026-11-05", vigenciaFim: null },
    { id: "inativa", ativo: false, vigenciaInicio: "2026-11-08", vigenciaFim: null },
    { id: "futura", ativo: true, vigenciaInicio: "2026-12-01", vigenciaFim: null },
  ];

  it("escolhe a ativa de início mais recente que cobre o período", () => {
    expect(regraVigente(regras, "2026-11-01", "2026-11-30")?.id).toBe("nova");
    expect(regraVigente(regras, "2026-10-01", "2026-10-31")?.id).toBe("antiga");
    expect(regraVigente([], "2026-10-01", "2026-10-31")).toBeNull();
  });

  it("maior valor primeiro, empate pelo nome", () => {
    const r = ranquearEquipes([
      { nome: "B", valorCalculado: 10 },
      { nome: "A", valorCalculado: 10 },
      { nome: "C", valorCalculado: 50 },
    ]);
    expect(r.map((e) => e.nome)).toEqual(["C", "A", "B"]);
  });
});
