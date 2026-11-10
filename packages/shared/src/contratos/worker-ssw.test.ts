import { describe, expect, it } from "vitest";

import { contratoWorkerSsw as c, EXEMPLOS_DO_CONTRATO as ex } from "./worker-ssw";

describe("contrato do worker-ssw (ADR 0012)", () => {
  it("os exemplos continuam válidos", () => {
    expect(c.pedirExecucao.entrada.parse(ex.pedirExecucao.entrada)).toEqual(
      ex.pedirExecucao.entrada,
    );
    expect(c.pedirExecucao.saida.parse(ex.pedirExecucao.saida)).toEqual(ex.pedirExecucao.saida);
    expect(c.consultarExecucao.entrada.parse(ex.consultarExecucao.entrada)).toEqual({
      aguardarMs: 30_000,
    });
    for (const saida of ex.consultarExecucao.saida) {
      expect(c.consultarExecucao.saida.parse(saida)).toEqual(saida);
    }
    expect(c.situacao.saida.parse(ex.situacao.saida)).toEqual(ex.situacao.saida);
  });

  it("job fora da lista e espera acima de 60 s são recusados", () => {
    expect(c.pedirExecucao.entrada.safeParse({ job: "sla-arquivos" }).success).toBe(false);
    expect(c.consultarExecucao.entrada.safeParse({ aguardarMs: "60001" }).success).toBe(false);
    expect(c.consultarExecucao.entrada.parse({})).toEqual({ aguardarMs: 0 });
  });
});
