import { describe, expect, it } from "vitest";

import { MODULOS } from "./modulos";
import { CAMINHO_DA_TELA, ehTela, primeiroCaminhoPermitido, telaDoCaminho, TELAS } from "./telas";

describe("telaDoCaminho", () => {
  it("acha a tela pelo caminho exato e por subcaminho", () => {
    expect(telaDoCaminho("/calendario")).toBe("calendario");
    expect(telaDoCaminho("/prazo-parceiro/123")).toBe("prazo_parceiro");
  });

  it("devolve a primeira do catálogo quando duas telas dividem o caminho", () => {
    // /historico/feriados também casa com /historico: o guard de hoje pega a primeira.
    expect(telaDoCaminho("/historico/feriados")).toBe("historico");
    expect(telaDoCaminho("/ranking")).toBe("ranking");
  });

  it("não confunde prefixo de texto com subcaminho", () => {
    expect(telaDoCaminho("/romaneios")).toBeUndefined();
    expect(telaDoCaminho("/login")).toBeUndefined();
  });
});

describe("primeiroCaminhoPermitido", () => {
  it("pula permissão de recurso e cai em /sem-acesso sem telas", () => {
    expect(primeiroCaminhoPermitido(["romaneio_placa", "ocorrencias"])).toBe("/ocorrencias");
    expect(primeiroCaminhoPermitido(["romaneio_placa"])).toBe("/sem-acesso");
    expect(primeiroCaminhoPermitido([])).toBe("/sem-acesso");
  });
});

describe("catálogo", () => {
  it("toda tela tem caminho e todo módulo só cita telas conhecidas", () => {
    for (const t of TELAS) expect(CAMINHO_DA_TELA[t]).toMatch(/^\//);
    for (const m of MODULOS) for (const t of m.telas) expect(ehTela(t)).toBe(true);
  });

  it("só um módulo é essencial", () => {
    expect(MODULOS.filter((m) => m.essencial).map((m) => m.chave)).toEqual(["essencial"]);
  });
});
