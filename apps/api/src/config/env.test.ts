import { describe, expect, it } from "vitest";

import { ambienteDeTeste, gerarChavePem } from "../testes/cenario";
import { carregarAmbiente, origensPermitidas } from "./env";

describe("ambiente", () => {
  it("falha no boot listando o que falta", () => {
    expect(() => carregarAmbiente({})).toThrow(/DATABASE_URL[\s\S]*WEB_URL/);
  });

  it("Google exige as três variáveis juntas; produção exige Redis e SMTP", () => {
    expect(() => ambienteDeTeste({ GOOGLE_CLIENT_ID: "x" })).toThrow("GOOGLE_CLIENT_SECRET");
    expect(() => ambienteDeTeste({ NODE_ENV: "production" })).toThrow(/REDIS_URL[\s\S]*SMTP_HOST/);
  });

  it("worker-ssw: URL e token juntos; jobs do ERP precisam de Redis", () => {
    expect(() => ambienteDeTeste({ WORKER_SSW_URL: "http://worker-ssw:3100" })).toThrow(
      "WORKER_SSW_TOKEN",
    );
    expect(() => ambienteDeTeste({ JOBS_LIGADOS: "true" })).toThrow("JOBS_LIGADOS");
    expect(
      ambienteDeTeste({
        WORKER_SSW_URL: "http://worker-ssw:3100",
        WORKER_SSW_TOKEN: "t".repeat(32),
      }).WORKER_SSW_URL,
    ).toBe("http://worker-ssw:3100");
  });

  it("aceita PEM com \\n literal e monta as origens do CORS", () => {
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
  });
});
