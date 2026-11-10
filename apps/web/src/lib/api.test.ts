import { contratosAuth } from "@erp/shared/contratos/auth";
import { contratosCalendario } from "@erp/shared/contratos/calendario";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chamar, definirTokenAcesso, ErroDaApi } from "./api";

interface Chamada {
  url: string;
  metodo: string;
  autorizacao: string | null;
  corpo: string | null;
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });

const TOKEN_EMITIDO = { tokenAcesso: "token-novo", expiraEmSegundos: 900 };
const NAO_AUTENTICADO = { erro: { codigo: "NAO_AUTENTICADO", mensagem: "Entre com sua conta." } };
const OK = { ok: true };

/** Servidor falso: cada rota responde pela função dada; guarda o que chegou. */
function servidor(rotas: Record<string, (c: Chamada) => Response>) {
  const chamadas: Chamada[] = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    const cabecalhos = new Headers(init.headers);
    const chamada: Chamada = {
      url,
      metodo: init.method ?? "GET",
      autorizacao: cabecalhos.get("authorization"),
      corpo: typeof init.body === "string" ? init.body : null,
    };
    chamadas.push(chamada);
    const rota = rotas[`${chamada.metodo} ${url.split("?")[0] ?? ""}`];
    return Promise.resolve(rota ? rota(chamada) : json(404, {}));
  });
  return chamadas;
}

beforeEach(() => {
  definirTokenAcesso(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("chamar", () => {
  it("manda o token, monta query string no GET e valida a saída", async () => {
    definirTokenAcesso("abc");
    const chamadas = servidor({
      "GET /api/v1/auth/ajuda-acesso": () =>
        json(200, { ativo: true, nome: null, email: "a@b.com", papelRotulo: null, admins: [] }),
      "DELETE /api/v1/calendario/feriados/7f6c9d1e-5b8a-4c2e-9f3a-1d2b3c4d5e6f": () =>
        json(200, OK),
    });
    await chamar(contratosAuth.ajudaAcesso);
    await chamar(contratosCalendario.excluirFeriado, {
      parametros: { id: "7f6c9d1e-5b8a-4c2e-9f3a-1d2b3c4d5e6f" },
    });
    expect(chamadas.map((c) => c.autorizacao)).toEqual(["Bearer abc", "Bearer abc"]);
  });

  it("GET leva a entrada na query string; POST no corpo", async () => {
    const chamadas = servidor({
      "GET /api/v1/calendario": () => json(500, {}),
      "POST /api/v1/auth/senha/esqueci": () => json(200, { mensagem: "Se existir, enviamos." }),
    });
    await expect(chamar(contratosCalendario.obter, { entrada: { ano: 2026 } })).rejects.toThrow();
    await chamar(contratosAuth.esqueciSenha, { entrada: { email: "a@b.com" } });
    expect(chamadas[0]?.url).toBe("/api/v1/calendario?ano=2026");
    expect(chamadas[1]?.corpo).toBe('{"email":"a@b.com"}');
  });

  it("401: renova uma vez e repete com o token novo", async () => {
    const chamadas = servidor({
      "GET /api/v1/auth/ajuda-acesso": (c) =>
        c.autorizacao === "Bearer token-novo"
          ? json(200, { ativo: true, nome: null, email: "a@b.com", papelRotulo: null, admins: [] })
          : json(401, NAO_AUTENTICADO),
      "POST /api/v1/auth/refresh": () => json(200, TOKEN_EMITIDO),
    });
    await expect(chamar(contratosAuth.ajudaAcesso)).resolves.toMatchObject({ ativo: true });
    expect(chamadas.map((c) => `${c.metodo} ${c.url}`)).toEqual([
      "GET /api/v1/auth/ajuda-acesso",
      "POST /api/v1/auth/refresh",
      "GET /api/v1/auth/ajuda-acesso",
    ]);
  });

  it("vários 401 ao mesmo tempo esperam uma renovação só (refresh é rotativo)", async () => {
    const chamadas = servidor({
      "POST /api/v1/auth/logout": (c) =>
        c.autorizacao ? json(200, OK) : json(401, NAO_AUTENTICADO),
      "POST /api/v1/auth/refresh": () => json(200, TOKEN_EMITIDO),
    });
    await Promise.all([chamar(contratosAuth.sair), chamar(contratosAuth.sair)]);
    expect(chamadas.filter((c) => c.url.endsWith("/refresh"))).toHaveLength(1);
  });

  it("renovação recusada: devolve o 401 (sessão vencida) sem repetir", async () => {
    const chamadas = servidor({
      "GET /api/v1/auth/me": () => json(401, NAO_AUTENTICADO),
      "POST /api/v1/auth/refresh": () =>
        json(401, { erro: { codigo: "SESSAO_EXPIRADA", mensagem: "Sua sessão expirou." } }),
    });
    const erro = await chamar(contratosAuth.eu).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroDaApi);
    expect(erro).toMatchObject({ codigo: "NAO_AUTENTICADO", status: 401 });
    expect(chamadas).toHaveLength(2);
  });

  it("401 do login é resposta final (senha errada), não dispara renovação", async () => {
    const chamadas = servidor({
      "POST /api/v1/auth/login": () =>
        json(401, { erro: { codigo: "NAO_AUTENTICADO", mensagem: "E-mail ou senha incorretos." } }),
    });
    await expect(
      chamar(contratosAuth.login, { entrada: { email: "a@b.com", senha: "x" } }),
    ).rejects.toThrow("E-mail ou senha incorretos.");
    expect(chamadas).toHaveLength(1);
  });

  it("sem rede vira INDISPONIVEL com mensagem para o operador", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("Failed to fetch")));
    await expect(chamar(contratosAuth.provedores)).rejects.toMatchObject({
      codigo: "INDISPONIVEL",
      status: 0,
    });
  });

  it("resposta de erro fora do padrão não vaza detalhe", async () => {
    servidor({
      "GET /api/v1/auth/provedores": () => new Response("<html>502</html>", { status: 502 }),
    });
    await expect(chamar(contratosAuth.provedores)).rejects.toMatchObject({
      codigo: "ERRO_INTERNO",
      status: 502,
    });
  });
});
