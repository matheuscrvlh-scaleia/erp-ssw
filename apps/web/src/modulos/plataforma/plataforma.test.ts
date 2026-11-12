import { describe, expect, it } from "vitest";

import { problemaDoLogo } from "./AbaDados";
import { parametrosEditados } from "./AbasDaEmpresa";
import { slugDoNome } from "./PaginaEmpresas";

describe("Plataforma › empresas", () => {
  it("slug sugerido pelo nome", () => {
    expect(slugDoNome("  Transportes São João Ltda. ")).toBe("transportes-sao-joao-ltda");
  });

  it("logo: só PNG/JPEG até 512 KB", () => {
    expect(problemaDoLogo({ type: "image/png", size: 1000 })).toBeNull();
    expect(problemaDoLogo({ type: "image/gif", size: 10 })).toBe("Envie o logo em PNG ou JPEG.");
    expect(problemaDoLogo({ type: "image/jpeg", size: 600 * 1024 })).toContain("512 KB");
  });

  it("parâmetros: troca os editados, lista por vírgula, apaga o vazio e mantém os desconhecidos", () => {
    expect(
      parametrosEditados(
        { host: "velho", origem: "env", porta: "22" },
        [{ chave: "host" }, { chave: "porta" }, { chave: "cnpjs", lista: true }],
        { host: " ftp.fr ", porta: "", cnpjs: "1, 2,,3" },
      ),
    ).toEqual({ host: "ftp.fr", origem: "env", cnpjs: ["1", "2", "3"] });
  });
});
