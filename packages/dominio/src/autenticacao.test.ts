import { describe, expect, it } from "vitest";

import { duracaoDoBloqueioMs, ehHashBcrypt, normalizarEmail } from "./autenticacao";

describe("bloqueio progressivo", () => {
  it("tolera 4 falhas e dobra a partir da 5ª até 1 hora", () => {
    expect(duracaoDoBloqueioMs(4)).toBe(0);
    expect(duracaoDoBloqueioMs(5)).toBe(60_000);
    expect(duracaoDoBloqueioMs(6)).toBe(120_000);
    expect(duracaoDoBloqueioMs(8)).toBe(480_000);
    expect(duracaoDoBloqueioMs(30)).toBe(3_600_000);
  });
});

describe("e-mail e hash", () => {
  it("normaliza e-mail", () => {
    expect(normalizarEmail("  Joana@FR.com.br ")).toBe("joana@fr.com.br");
  });

  it("reconhece bcrypt do Supabase e não confunde com argon2id", () => {
    expect(ehHashBcrypt("$2a$10$abcdefghijklmnopqrstuv")).toBe(true);
    expect(ehHashBcrypt("$2b$12$abcdefghijklmnopqrstuv")).toBe(true);
    expect(ehHashBcrypt("$argon2id$v=19$m=19456,t=2,p=1$abc$def")).toBe(false);
  });
});
