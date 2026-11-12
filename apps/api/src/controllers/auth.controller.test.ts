import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type ProvedorGoogle } from "../infra/google";
import {
  type Cenario,
  construirAppDeTeste,
  criarCenario,
  entrarComo,
  usuarioComSenha,
} from "../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
});
afterEach(() => app.close());

function cookieDeRefresh(resposta: { cookies: { name: string; value: string }[] }) {
  return resposta.cookies.find((c) => c.name === "erp_refresh");
}

describe("POST /api/v1/auth/login", () => {
  it("422 com mensagem em português quando o corpo é inválido", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "x" },
    });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toEqual({
      erro: { codigo: "ENTRADA_INVALIDA", mensagem: "email: Informe um e-mail válido." },
    });
  });

  it("401 genérico com senha errada", async () => {
    await usuarioComSenha(cenario, "joana@fr.com.br", "senha-boa-123");
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "joana@fr.com.br", senha: "errada" },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toEqual({
      erro: { codigo: "NAO_AUTENTICADO", mensagem: "E-mail ou senha incorretos." },
    });
  });

  it("200: access token no corpo e refresh só em cookie httpOnly/Secure/Strict", async () => {
    const empresa = cenario.banco.criarEmpresa();
    const usuario = await usuarioComSenha(cenario, "joana@fr.com.br", "senha-boa-123");
    cenario.banco.vincular(usuario.id, empresa.id);
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "joana@fr.com.br", senha: "senha-boa-123" },
    });
    expect(r.statusCode).toBe(200);
    expect(Object.keys(r.json<object>()).sort()).toEqual(["expiraEmSegundos", "tokenAcesso"]);
    expect(cookieDeRefresh(r)).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "Strict",
      path: "/api/v1/auth",
    });
  });
});

describe("conta desativada", () => {
  it("não entra (com a senha certa), não renova a sessão e não usa a Plataforma", async () => {
    const empresa = cenario.banco.criarEmpresa();
    const usuario = await usuarioComSenha(cenario, "joana@fr.com.br", "senha-boa-123");
    cenario.banco.vincular(usuario.id, empresa.id);
    const entrar = () =>
      app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: { email: "joana@fr.com.br", senha: "senha-boa-123" },
      });
    const login = await entrar();
    const refresh = cookieDeRefresh(login)?.value ?? "";

    usuario.ativo = false;
    const negado = await entrar();
    expect(negado.statusCode).toBe(403);
    expect(negado.json()).toEqual({
      erro: { codigo: "SEM_PERMISSAO", mensagem: "Sua conta foi desativada por um administrador." },
    });
    const renovado = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { erp_refresh: refresh },
    });
    expect(renovado.statusCode).toBe(401);

    cenario.banco.plataformaAdmins.add(usuario.id);
    const headers = await entrarComo(cenario, usuario.id, empresa.id);
    const plataforma = await app.inject({ url: "/api/v1/plataforma/empresas", headers });
    expect(plataforma.statusCode).toBe(403);
  });
});

describe("refresh e logout", () => {
  it("refresh sem cookie: 401 e cookie apagado", async () => {
    const r = await app.inject({ method: "POST", url: "/api/v1/auth/refresh" });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject({ erro: { codigo: "SESSAO_EXPIRADA" } });
  });

  it("login → refresh → logout → refresh recusado", async () => {
    await usuarioComSenha(cenario, "joana@fr.com.br", "senha-boa-123");
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "joana@fr.com.br", senha: "senha-boa-123" },
    });
    const primeiro = cookieDeRefresh(login)?.value ?? "";
    const renovado = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { erp_refresh: primeiro },
    });
    expect(renovado.statusCode).toBe(200);
    const segundo = cookieDeRefresh(renovado)?.value ?? "";
    expect(segundo).not.toBe(primeiro);

    const saida = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      cookies: { erp_refresh: segundo },
    });
    expect(saida.json()).toEqual({ ok: true });
    const depois = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      cookies: { erp_refresh: segundo },
    });
    expect(depois.statusCode).toBe(401);
  });
});

describe("GET /api/v1/auth/me", () => {
  it("401 sem token e 401 SESSAO_EXPIRADA com token adulterado", async () => {
    expect((await app.inject({ url: "/api/v1/auth/me" })).statusCode).toBe(401);
    const r = await app.inject({
      url: "/api/v1/auth/me",
      headers: { authorization: "Bearer x.y.z" },
    });
    expect(r.json()).toMatchObject({ erro: { codigo: "SESSAO_EXPIRADA" } });
  });

  it("200 com telas do cargo, módulos e empresas; admin da plataforma ganha a seção Plataforma", async () => {
    const empresa = cenario.banco.criarEmpresa();
    cenario.banco.liberarModulo(empresa.id, "historico");
    cenario.banco.definirCargo(empresa.id, "operador", {
      rotulo: "Operador",
      telas: ["calendario", "performance"],
    });
    const usuario = cenario.banco.criarUsuario({ email: "op@fr.com.br" });
    cenario.banco.vincular(usuario.id, empresa.id, { papel: "operador" });

    const r = await app.inject({
      url: "/api/v1/auth/me",
      headers: await entrarComo(cenario, usuario.id, empresa.id),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      ativo: true,
      papelRotulo: "Operador",
      telas: ["calendario"],
      telasBloqueadas: [{ tela: "performance", moduloNome: "Performance" }],
      empresa: { id: empresa.id, nomeCurto: "FR" },
      empresas: [{ id: empresa.id, nome: "FR Transportes" }],
      adminPlataforma: false,
    });

    cenario.banco.plataformaAdmins.add(usuario.id);
    const plataforma = await app.inject({
      url: "/api/v1/auth/me",
      headers: await entrarComo(cenario, usuario.id, empresa.id),
    });
    expect(plataforma.json<{ telas: string[] }>().telas).toContain("plataforma_empresas");
  });

  it("logout derruba também o access token (família revogada)", async () => {
    const usuario = cenario.banco.criarUsuario({ email: "op@fr.com.br" });
    const headers = await entrarComo(cenario, usuario.id, null);
    for (const s of cenario.banco.sessoes) s.revogadaEm = new Date();
    const r = await app.inject({ url: "/api/v1/auth/me", headers });
    expect(r.json()).toMatchObject({ erro: { codigo: "SESSAO_EXPIRADA" } });
  });
});

describe("esqueci a senha", () => {
  it("responde igual para e-mail existente e inexistente", async () => {
    await usuarioComSenha(cenario, "joana@fr.com.br", "senha-boa-123");
    const pedir = (email: string) =>
      app.inject({ method: "POST", url: "/api/v1/auth/senha/esqueci", payload: { email } });
    const existente = await pedir("joana@fr.com.br");
    const inexistente = await pedir("ninguem@fr.com.br");
    expect(existente.statusCode).toBe(200);
    expect(existente.json()).toEqual(inexistente.json());
  });
});

describe("Google", () => {
  it("rota não existe sem configuração e provedores diz que está desligado", async () => {
    expect((await app.inject({ url: "/api/v1/auth/google" })).statusCode).toBe(404);
    expect((await app.inject({ url: "/api/v1/auth/provedores" })).json()).toEqual({
      google: false,
    });
  });

  it("ida guarda o desafio em cookie assinado; volta cria a sessão e redireciona", async () => {
    const google: ProvedorGoogle = {
      iniciar: () =>
        Promise.resolve({
          url: "https://accounts.google.com/o/oauth2/v2/auth?x=1",
          desafio: { verificador: "v", estado: "e", nonce: "n" },
        }),
      concluir: (_url, desafio) =>
        Promise.resolve({
          sujeito: `sub-${desafio.estado}`,
          email: "joana@fr.com.br",
          emailVerificado: true,
        }),
    };
    cenario.ambiente = {
      ...cenario.ambiente,
      GOOGLE_REDIRECT_URI: "http://localhost:5173/api/v1/auth/google/retorno",
    };
    await app.close();
    app = await construirAppDeTeste(cenario, google);
    cenario.banco.criarUsuario({ email: "joana@fr.com.br" });

    const ida = await app.inject({ url: "/api/v1/auth/google?redirect=//malicioso.com" });
    expect(ida.statusCode).toBe(302);
    expect(ida.headers.location).toContain("accounts.google.com");
    const desafio = ida.cookies.find((c) => c.name === "erp_google");
    expect(desafio).toMatchObject({ httpOnly: true, sameSite: "Lax" });

    const volta = await app.inject({
      url: "/api/v1/auth/google/retorno?code=abc&state=e",
      cookies: { erp_google: desafio?.value ?? "" },
    });
    expect(volta.statusCode).toBe(302);
    expect(volta.headers.location).toBe("/");
    expect(cookieDeRefresh(volta)).toBeDefined();

    const semCookie = await app.inject({ url: "/api/v1/auth/google/retorno?code=abc" });
    expect(semCookie.headers.location).toBe("/login?erro=falhou");

    // Tab entre as barras: o navegador descarta e "/<tab>/site" viraria "//site".
    for (const redirect of [
      "%2F%09%2Fevil.example",
      "%2F%20%2Fevil.example",
      "%2Fpainel%3Fa%3D1",
    ]) {
      const outraIda = await app.inject({ url: `/api/v1/auth/google?redirect=${redirect}` });
      const outroDesafio = outraIda.cookies.find((c) => c.name === "erp_google")?.value ?? "";
      const outraVolta = await app.inject({
        url: "/api/v1/auth/google/retorno?code=abc&state=e",
        cookies: { erp_google: outroDesafio },
      });
      expect(outraVolta.headers.location).toBe(
        redirect.startsWith("%2Fpainel") ? "/painel?a=1" : "/",
      );
    }
  });
});

describe("acesso guardado por 30 s", () => {
  it("revogação fora da API vale em até 30 s; qualquer escrita da API limpa na hora", async () => {
    const empresa = cenario.banco.criarEmpresa();
    const usuario = await usuarioComSenha(cenario, "joana@fr.com.br", "senha-boa-123");
    cenario.banco.vincular(usuario.id, empresa.id);
    const eu = (headers: { authorization: string }) =>
      app.inject({ url: "/api/v1/auth/me", headers });
    const revogar = () => {
      for (const s of cenario.banco.sessoes) s.revogadaEm = cenario.relogio.atual;
    };

    const headers = await entrarComo(cenario, usuario.id, empresa.id);
    expect((await eu(headers)).statusCode).toBe(200);
    revogar();
    expect((await eu(headers)).statusCode).toBe(200);
    cenario.relogio.avancar(31_000);
    expect((await eu(headers)).statusCode).toBe(401);

    const outra = await entrarComo(cenario, usuario.id, empresa.id);
    expect((await eu(outra)).statusCode).toBe(200);
    revogar();
    const escrita = await app.inject({ method: "POST", url: "/api/v1/auth/logout" });
    expect(escrita.statusCode).toBeLessThan(400);
    expect((await eu(outra)).statusCode).toBe(401);
  });
});
