import { describe, expect, it } from "vitest";

import { paraTexto, TOM_DO_STATUS } from "./texts";

describe("Plataforma › textos", () => {
  it("tom do selo de cada status da empresa", () => {
    expect(TOM_DO_STATUS).toEqual({
      implantacao: "alerta",
      ativa: "sucesso",
      suspensa: "erro",
      encerrada: "neutro",
    });
  });

  it("parâmetro como texto do campo: vazio, lista por vírgula e valor solto", () => {
    expect(paraTexto(undefined)).toBe("");
    expect(paraTexto(null)).toBe("");
    expect(paraTexto(["1", "2"])).toBe("1, 2");
    expect(paraTexto("ftp.fr")).toBe("ftp.fr");
    expect(paraTexto(22)).toBe("22");
  });
});
