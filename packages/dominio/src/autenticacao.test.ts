import { describe, expect, it } from "vitest";

import { duracaoDoBloqueioMs, FALHAS_TOLERADAS_POR_IP, normalizarEmail } from "./autenticacao";

describe("bloqueio progressivo", () => {
  it("tolera 4 falhas e dobra a partir da 5ª até 1 hora", () => {
    expect(duracaoDoBloqueioMs(4)).toBe(0);
    expect(duracaoDoBloqueioMs(5)).toBe(60_000);
    expect(duracaoDoBloqueioMs(6)).toBe(120_000);
    expect(duracaoDoBloqueioMs(8)).toBe(480_000);
    expect(duracaoDoBloqueioMs(30)).toBe(3_600_000);
  });

  it("por IP o limite é maior", () => {
    expect(duracaoDoBloqueioMs(19, FALHAS_TOLERADAS_POR_IP)).toBe(0);
    expect(duracaoDoBloqueioMs(20, FALHAS_TOLERADAS_POR_IP)).toBe(60_000);
  });
});

describe("e-mail", () => {
  it("normaliza e-mail", () => {
    expect(normalizarEmail("  Joana@FR.com.br ")).toBe("joana@fr.com.br");
  });
});
