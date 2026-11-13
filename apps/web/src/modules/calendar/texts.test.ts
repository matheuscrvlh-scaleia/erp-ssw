import { type Feriado } from "@erp/shared/contracts/calendar";
import { describe, expect, it } from "vitest";

import { formatarDiaCurto, localDo, nomesDasUnidades, textoDaDistancia } from "./texts";

describe("textos", () => {
  it("dia curto e distância", () => {
    expect(formatarDiaCurto("2026-11-15")).toBe("Dom, 15 de nov");
    expect(textoDaDistancia(0)).toBe("hoje");
    expect(textoDaDistancia(5)).toBe("em 5d");
    expect(textoDaDistancia(-2)).toBe("há 2d");
  });

  it("nomes das unidades impactadas", () => {
    expect(nomesDasUnidades([])).toBe("nenhuma unidade cadastrada");
    expect(
      nomesDasUnidades([
        { id: "1", nome: "Matriz", cidade: null, uf: null },
        { id: "2", nome: "Filial", cidade: null, uf: null },
      ]),
    ).toBe("Matriz, Filial");
  });

  it("local do feriado", () => {
    const feriado: Feriado = {
      id: "1",
      data: "2026-01-25",
      tipo: "municipal",
      cidade: "São Paulo",
      uf: "SP",
      descricao: "Aniversário de São Paulo",
      geradoAutomaticamente: false,
    };
    expect(localDo(feriado)).toBe("São Paulo / SP");
    expect(localDo({ ...feriado, cidade: null })).toBe("SP");
    expect(localDo({ ...feriado, cidade: null, uf: null })).toBe("");
  });
});
