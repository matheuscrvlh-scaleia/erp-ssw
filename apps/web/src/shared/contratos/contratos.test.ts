import { describe, expect, it } from "vitest";

import { contratosAuth } from "./auth";
import { contratosCalendario } from "./calendario";

describe("contratos", () => {
  it("mensagens de validação em português", () => {
    const r = contratosAuth.login.entrada.safeParse({ email: "x", senha: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual([
      "Informe um e-mail válido.",
      "Informe a senha.",
    ]);
  });

  it("calendário: ano vem da query como texto e vira número", () => {
    expect(contratosCalendario.obter.entrada.parse({ ano: "2026" })).toEqual({ ano: 2026 });
    expect(contratosCalendario.obter.entrada.safeParse({ ano: "1999" }).success).toBe(false);
  });

  it("calendário: recorrência tem padrão de 5 anos e data inválida é recusada", () => {
    const base = { data: "2026-11-20", tipo: "municipal", cidade: "Campinas", uf: "SP" };
    expect(
      contratosCalendario.criarFeriado.entrada.parse({ ...base, descricao: "Aniversário" }),
    ).toMatchObject({ recorrente: false, anosAFrente: 5 });
    expect(
      contratosCalendario.criarFeriado.entrada.safeParse({
        ...base,
        data: "2026-02-30",
        descricao: "x".repeat(3),
      }).success,
    ).toBe(false);
  });
});
