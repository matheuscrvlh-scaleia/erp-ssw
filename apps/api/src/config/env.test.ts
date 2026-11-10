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
