import { describe, expect, it } from "vitest";

import { ambienteDeTeste, gerarChavePem } from "../testes/cenario";
import { carregarAmbiente, origensPermitidas } from "./env";

describe("ambiente", () => {
  it("falha no boot listando o que falta", () => {
    expect(() => carregarAmbiente({})).toThrow(/DATABASE_URL[\s\S]*JWT_CHAVE_PRIVADA/);
  });

  it("produção exige Redis e a chave mestra", () => {
    expect(() => ambienteDeTeste({ NODE_ENV: "production" })).toThrow(
      /REDIS_URL[\s\S]*SEGREDOS_CHAVES/,
    );
  });

  it("jobs do ERP precisam de Redis; a chave mestra é opcional fora de produção", () => {
    expect(() => ambienteDeTeste({ JOBS_LIGADOS: "true" })).toThrow("JOBS_LIGADOS");
    expect(
      carregarAmbiente({ DATABASE_URL: "postgres://x", JWT_CHAVE_PRIVADA: gerarChavePem() })
        .SEGREDOS_CHAVES,
    ).toBeUndefined();
    expect(
      carregarAmbiente({
        DATABASE_URL: "postgres://x",
        JWT_CHAVE_PRIVADA: gerarChavePem(),
        SEGREDOS_CHAVES: `1:${Buffer.alloc(32).toString("base64")}`,
      }).SEGREDOS_CHAVE_ATUAL,
    ).toBeUndefined();
  });

  it("aceita PEM com \n literal e monta as origens do CORS", () => {
    const pemEmUmaLinha = gerarChavePem().replaceAll("\n", "\\n");
    const ambiente = ambienteDeTeste({
      JWT_CHAVE_PRIVADA: pemEmUmaLinha,
      CORS_ORIGENS: "https://a.com, https://b.com",
    });
    expect(pemEmUmaLinha).not.toContain("\n");
    expect(ambiente.JWT_CHAVE_PRIVADA).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
    expect(origensPermitidas(ambiente)).toEqual([
      "http://localhost:5173",
      "https://a.com",
      "https://b.com",
    ]);
    expect(origensPermitidas({ ...ambiente, WEB_URL: undefined, CORS_ORIGENS: undefined })).toEqual(
      [],
    );
  });
});
