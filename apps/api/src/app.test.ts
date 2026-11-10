import { describe, expect, it } from "vitest";

import { construirAppDeTeste, criarCenario } from "./testes/cenario";

describe("app", () => {
  it("healthz sempre 200; readyz 503 quando o banco não responde", async () => {
    const cenario = criarCenario();
    const app = await construirAppDeTeste(cenario);
    expect((await app.inject({ url: "/healthz" })).json()).toEqual({ status: "ok" });
    expect((await app.inject({ url: "/readyz" })).statusCode).toBe(200);

    cenario.banco.falharCom = new Error("fora");
    const pronto = await app.inject({ url: "/readyz" });
    expect(pronto.statusCode).toBe(503);
    expect(pronto.json()).toMatchObject({ erro: { codigo: "INDISPONIVEL" } });
    await app.close();
  });

  it("rota desconhecida: 404 no formato padrão; cabeçalhos de segurança presentes", async () => {
    const app = await construirAppDeTeste(criarCenario());
    const r = await app.inject({ url: "/api/v1/nao-existe" });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({
      erro: { codigo: "NAO_ENCONTRADO", mensagem: "Rota não encontrada." },
    });
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    await app.close();
  });

  it("CORS só libera a origem do web", async () => {
    const app = await construirAppDeTeste(criarCenario());
    const permitido = await app.inject({
      url: "/healthz",
      headers: { origin: "http://localhost:5173" },
    });
    expect(permitido.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const estranho = await app.inject({
      url: "/healthz",
      headers: { origin: "https://malicioso.com" },
    });
    expect(estranho.headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });
});
