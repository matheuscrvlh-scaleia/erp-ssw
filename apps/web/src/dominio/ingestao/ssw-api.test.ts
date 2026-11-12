import { describe, expect, it } from "vitest";

import { saudeDaIntegracaoSsw } from "./ssw-api";

const agora = new Date("2026-11-10T12:00:00Z");
const horasAtras = (h: number) => new Date(agora.getTime() - h * 3_600_000);

describe("saúde da SSW API (faixa do layout)", () => {
  it("integração desligada não acende a faixa", () => {
    expect(
      saudeDaIntegracaoSsw({ ativa: false, configurado: false, tokenGeradoEm: null, agora }),
    ).toMatchObject({ saudavel: true, motivo: "ok" });
  });

  it("sem credenciais, sem token, token vencido (4 h) e ok", () => {
    const base = { ativa: true, agora };
    expect(
      saudeDaIntegracaoSsw({ ...base, configurado: false, tokenGeradoEm: null }),
    ).toMatchObject({ saudavel: false, motivo: "sem_credenciais" });
    expect(saudeDaIntegracaoSsw({ ...base, configurado: true, tokenGeradoEm: null })).toMatchObject(
      {
        motivo: "sem_token",
      },
    );
    expect(
      saudeDaIntegracaoSsw({ ...base, configurado: true, tokenGeradoEm: horasAtras(4) }),
    ).toMatchObject({ saudavel: false, motivo: "token_expirado" });
    expect(
      saudeDaIntegracaoSsw({ ...base, configurado: true, tokenGeradoEm: horasAtras(3.9) }),
    ).toMatchObject({ saudavel: true, tokenValido: true, motivo: "ok" });
  });
});
