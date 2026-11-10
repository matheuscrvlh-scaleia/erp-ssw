import { describe, expect, it } from "vitest";

import { contratosAhgora } from "./ahgora";
import { contratosBonificacaoEntrega } from "./bonificacao-entrega";
import { contratosRanking } from "./ranking";

describe("contratos do ranking, bonificação e ponto", () => {
  it("regra: parâmetro de critério precisa ser número; vigência final não antecede a inicial", () => {
    const base = { nome: "Q4", vigenciaInicio: "2026-10-01" };
    const r = contratosRanking.salvarRegra.entrada;
    expect(
      r.safeParse({ ...base, criterios: [{ criterio: "entregas_prazo", parametros: { peso: 2 } }] })
        .success,
    ).toBe(true);
    expect(
      r.safeParse({
        ...base,
        criterios: [{ criterio: "entregas_prazo", parametros: { peso: "x" } }],
      }).success,
    ).toBe(false);
    expect(r.safeParse({ ...base, vigenciaFim: "2026-09-30" }).success).toBe(false);
  });

  it("apuração da bonificação: no máximo 45 dias e fim depois do início", () => {
    const a = contratosBonificacaoEntrega.apurar.entrada;
    expect(a.parse({ inicio: "2026-10-01", fim: "2026-10-31" })).toMatchObject({
      usarPonto: false,
    });
    const longo = a.safeParse({ inicio: "2026-09-01", fim: "2026-10-31" });
    expect(longo.error?.issues[0]?.message).toBe(
      "Apure no máximo 45 dias por vez — períodos maiores estouram o tempo da consulta",
    );
    const invertido = a.safeParse({ inicio: "2026-10-02", fim: "2026-10-01" });
    expect(invertido.error?.issues[0]?.message).toBe(
      "Data final deve ser maior ou igual à data inicial",
    );
    expect(a.safeParse({ inicio: "01/10/2026", fim: "2026-10-01" }).error?.issues[0]?.message).toBe(
      "Data deve estar no formato YYYY-MM-DD",
    );
  });

  it("ponto: batidas exigem funcionário e até 30 dias; apuração até um mês", () => {
    const b = contratosAhgora.batidas.entrada;
    expect(b.safeParse({ inicio: "2026-10-01", fim: "2026-10-05" }).error?.issues[0]?.message).toBe(
      "Informe o funcionário (id, matrícula ou PIS)",
    );
    expect(
      b.safeParse({ funcionarioId: "1", inicio: "2026-10-01", fim: "2026-11-05" }).error?.issues[0]
        ?.message,
    ).toBe("O período máximo por consulta é de 30 dias");
    const ap = contratosAhgora.apuracao.entrada.parse({ inicio: "2026-10-01", fim: "2026-10-31" });
    expect(ap.incluirDemitidos).toBe(false);
  });

  it("link público: token de 48 hex", () => {
    const p = contratosRanking.publico.parametros;
    expect(p.safeParse({ token: "a".repeat(48) }).success).toBe(true);
    expect(p.safeParse({ token: "xyz" }).success).toBe(false);
  });
});
