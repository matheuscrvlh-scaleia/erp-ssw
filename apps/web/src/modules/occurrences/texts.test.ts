import { describe, expect, it } from "vitest";

import { identificacaoDoCte, rotulosDoResponsavel, tomDoResponsavel } from "./texts";

describe("textos de /ocorrencias", () => {
  it("o responsável FR aparece com o nome curto da empresa", () => {
    const rotulos = rotulosDoResponsavel("ACME");
    expect(rotulos.FR).toBe("ACME");
    expect(rotulos.transportador).toBe("Transportador");
    expect(rotulos.destinatario).toBe("Destinatário");
  });

  it("transportador em erro, pendente em alerta, o resto neutro", () => {
    expect(tomDoResponsavel("transportador")).toBe("erro");
    expect(tomDoResponsavel("pendente")).toBe("alerta");
    expect(tomDoResponsavel("cliente")).toBe("neutro");
    expect(tomDoResponsavel("FR")).toBe("neutro");
  });

  it("NF em destaque quando houver; senão o CT-e", () => {
    expect(identificacaoDoCte(123, "ABC0001")).toEqual({
      principal: "123",
      rotulo: "NF",
      secundario: "ABC0001",
    });
    expect(identificacaoDoCte(null, "ABC0001")).toEqual({
      principal: "ABC0001",
      rotulo: "CTRC",
      secundario: null,
    });
  });
});
