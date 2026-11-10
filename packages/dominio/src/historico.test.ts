import { describe, expect, it } from "vitest";

import { diasComContexto, garantirQuePodeAlterarAnotacao, nacionaisFixosDoAno } from "./historico";

describe("histórico", () => {
  it("só o autor ou um administrador altera a anotação (Q09)", () => {
    expect(() => garantirQuePodeAlterarAnotacao("u1", "u1", "operador")).not.toThrow();
    expect(() => garantirQuePodeAlterarAnotacao("u1", "u2", "admin")).not.toThrow();
    expect(() => garantirQuePodeAlterarAnotacao("u1", "u2", "super_admin")).not.toThrow();
    expect(() => garantirQuePodeAlterarAnotacao("u1", "u2", "gestor")).toThrow(
      "Só o autor ou um administrador pode alterar esta anotação.",
    );
    expect(() => garantirQuePodeAlterarAnotacao(null, "u2", null)).toThrow();
  });

  it("dias com contexto juntam anotações e feriados", () => {
    expect(
      diasComContexto([{ data: "2026-11-02" }, { data: "2026-11-03" }], [{ data: "2026-11-02" }]),
    ).toBe(2);
  });

  it("9 nacionais fixos do ano", () => {
    const fixos = nacionaisFixosDoAno(2027);
    expect(fixos).toHaveLength(9);
    expect(fixos[0]).toEqual({ data: "2027-01-01", descricao: "Confraternização Universal" });
    expect(fixos.at(-1)).toEqual({ data: "2027-12-25", descricao: "Natal" });
  });
});
