import { describe, expect, it } from "vitest";

import { apresentarApuracao } from "./ahgora.view";

const funcionario = (name: string) => ({
  register: name,
  name,
  department: "Entrega",
  demitido: false,
  diasComRegistro: 0,
  minutosApurados: 0,
  diasARevisar: 0,
  dias: [],
});

describe("apresentarApuracao", () => {
  it("lista os colaboradores em ordem alfabética (pt-BR), sem mexer no dado do model", () => {
    const funcionarios = [funcionario("Óscar"), funcionario("Ana"), funcionario("Bruno")];
    const r = apresentarApuracao({ inicio: "2026-11-01", fim: "2026-11-10", funcionarios });
    expect(r.funcionarios.map((f) => f.name)).toEqual(["Ana", "Bruno", "Óscar"]);
    expect(funcionarios[0]?.name).toBe("Óscar");
  });
});
