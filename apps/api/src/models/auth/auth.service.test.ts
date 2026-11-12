import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";

import { hashDoToken } from "../../infra/aleatorio";
import { type Cenario, criarCenario, usuarioComSenha } from "../../testes/cenario";
import {
  ajudaDeAcesso,
  definirSenhaPorToken,
  entrar,
  entrarComGoogle,
  JANELA_DE_RENOVACAO_CONCORRENTE_MS,
  pedirRedefinicao,
  renovar,
  sair,
  trocarEmpresa,
} from "./auth.service";

const origem = { ip: "10.0.0.1", userAgent: "vitest" };
const SENHA = "senha-boa-123";

let cenario: Cenario;
beforeEach(() => {
  cenario = criarCenario();
});

async function preparar() {
  const empresa = cenario.banco.criarEmpresa();
  const usuario = await usuarioComSenha(cenario, "joana@fr.com.br", SENHA, { nome: "Joana" });
  cenario.banco.vincular(usuario.id, empresa.id, { papel: "admin" });
  return { empresa, usuario };
}

async function errosDoLogin(email: string, senha: string, vezes: number) {
  const mensagens: string[] = [];
  for (let i = 0; i < vezes; i++) {
    await entrar(cenario.deps, { email, senha }, origem).catch((e: unknown) =>
      mensagens.push(e instanceof Error ? e.message : "?"),
    );
  }
  return mensagens;
}

describe("entrar", () => {
  it("abre sessão na empresa do vínculo, grava o refresh só como hash e audita", async () => {
    const { empresa, usuario } = await preparar();
    const sessao = await entrar(cenario.deps, { email: " Joana@FR.com.br ", senha: SENHA }, origem);

    const verificado = await cenario.tokens.verificar(sessao.tokenAcesso);
    expect(verificado).toMatchObject({
      valido: true,
      sessao: { usuarioId: usuario.id, empresaId: empresa.id },
    });
    expect(sessao.expiraEmSegundos).toBe(900);
    const [gravada] = cenario.banco.sessoes;
    expect(gravada?.tokenHash).toBe(hashDoToken(sessao.refresh.token));
    expect(gravada?.tokenHash).not.toBe(sessao.refresh.token);
    expect(cenario.banco.auditoria.map((a) => a.acao)).toEqual(["login"]);
  });

  it("senha bcrypt do sistema antigo entra e é regravada em argon2id", async () => {
    const usuario = cenario.banco.criarUsuario({
      email: "antigo@fr.com.br",
      senhaHash: await bcrypt.hash(SENHA, 4),
      senhaAlgoritmo: "bcrypt",
    });
    await entrar(cenario.deps, { email: usuario.email, senha: SENHA }, origem);
    expect(usuario.senhaAlgoritmo).toBe("argon2id");
    expect(usuario.senhaHash).toMatch(/^\$argon2id\$/);
    await expect(
      entrar(cenario.deps, { email: usuario.email, senha: SENHA }, origem),
    ).resolves.toBeDefined();
  });

  it("senha errada e e-mail inexistente dão a mesma mensagem e o mesmo bloqueio", async () => {
    await preparar();
    const contaExistente = await errosDoLogin("joana@fr.com.br", "errada", 6);
    const contaInexistente = await errosDoLogin("ninguem@fr.com.br", "errada", 6);
    const esperado = [
      ...Array<string>(5).fill("E-mail ou senha incorretos."),
      "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
    ];
    expect(contaExistente).toEqual(esperado);
    expect(contaInexistente).toEqual(esperado);
  });

  it("conta bloqueada não entra nem com a senha certa até o bloqueio vencer", async () => {
    await preparar();
    await errosDoLogin("joana@fr.com.br", "errada", 5);
    await expect(
      entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem),
    ).rejects.toMatchObject({ codigo: "MUITAS_TENTATIVAS" });
    cenario.relogio.avancar(61_000);
    await expect(
      entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem),
    ).resolves.toBeDefined();
  });
});

describe("renovar e sair", () => {
  it("rotaciona o refresh e mantém a família", async () => {
    await preparar();
    const primeira = await entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem);
    const segunda = await renovar(cenario.deps, primeira.refresh.token, origem);
    expect(segunda.refresh.token).not.toBe(primeira.refresh.token);
    expect(new Set(cenario.banco.sessoes.map((s) => s.familiaId)).size).toBe(1);
    await expect(renovar(cenario.deps, segunda.refresh.token, origem)).resolves.toBeDefined();
  });

  it("duas abas renovando juntas não derrubam a sessão", async () => {
    await preparar();
    const sessao = await entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem);
    await renovar(cenario.deps, sessao.refresh.token, origem);
    cenario.relogio.avancar(JANELA_DE_RENOVACAO_CONCORRENTE_MS - 1_000);
    await expect(renovar(cenario.deps, sessao.refresh.token, origem)).resolves.toBeDefined();
  });

  it("refresh antigo reaparecendo depois da janela revoga a família inteira", async () => {
    await preparar();
    const antiga = await entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem);
    const atual = await renovar(cenario.deps, antiga.refresh.token, origem);
    cenario.relogio.avancar(JANELA_DE_RENOVACAO_CONCORRENTE_MS + 1_000);

    await expect(renovar(cenario.deps, antiga.refresh.token, origem)).rejects.toMatchObject({
      codigo: "SESSAO_EXPIRADA",
    });
    await expect(renovar(cenario.deps, atual.refresh.token, origem)).rejects.toMatchObject({
      codigo: "SESSAO_EXPIRADA",
    });
    expect(cenario.banco.sessoes.every((s) => s.motivo === "reuso_detectado")).toBe(true);
  });

  it("sair revoga a família e o refresh deixa de valer", async () => {
    await preparar();
    const sessao = await entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem);
    await sair(cenario.deps, sessao.refresh.token);
    await expect(renovar(cenario.deps, sessao.refresh.token, origem)).rejects.toMatchObject({
      codigo: "SESSAO_EXPIRADA",
    });
  });

  it("sessão parada há mais de 30 min não renova e a família é revogada", async () => {
    await preparar();
    const sessao = await entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem);
    cenario.relogio.avancar(29 * 60_000);
    const viva = await renovar(cenario.deps, sessao.refresh.token, origem);
    cenario.relogio.avancar(31 * 60_000);
    await expect(renovar(cenario.deps, viva.refresh.token, origem)).rejects.toMatchObject({
      codigo: "SESSAO_EXPIRADA",
    });
    expect(cenario.banco.sessoes.every((s) => s.motivo === "inatividade")).toBe(true);
  });

  it("renovar não estende: o login vale 8 h no máximo", async () => {
    await preparar();
    let sessao = await entrar(cenario.deps, { email: "joana@fr.com.br", senha: SENHA }, origem);
    const limite = sessao.refresh.expiraEm.getTime();
    expect(limite - cenario.relogio.atual.getTime()).toBe(8 * 60 * 60_000);
    for (let i = 0; i < 31; i++) {
      cenario.relogio.avancar(15 * 60_000);
      sessao = await renovar(cenario.deps, sessao.refresh.token, origem);
      expect(sessao.refresh.expiraEm.getTime()).toBe(limite);
    }
    cenario.relogio.avancar(15 * 60_000);
    await expect(renovar(cenario.deps, sessao.refresh.token, origem)).rejects.toMatchObject({
      codigo: "SESSAO_EXPIRADA",
    });
  });
});

describe("trocar empresa", () => {
  it("só troca para empresa com vínculo e reemite o token com ela", async () => {
    const { usuario } = await preparar();
    const outra = cenario.banco.criarEmpresa({ nome: "Outra" });
    const sessao = await entrar(cenario.deps, { email: usuario.email, senha: SENHA }, origem);
    const verificado = await cenario.tokens.verificar(sessao.tokenAcesso);
    if (!verificado.valido) throw new Error("token inválido");

    await expect(
      trocarEmpresa(cenario.deps, verificado.sessao, outra.id, origem),
    ).rejects.toMatchObject({
      codigo: "SEM_PERMISSAO",
    });

    cenario.banco.vincular(usuario.id, outra.id, { papel: "operador" });
    const novo = await trocarEmpresa(cenario.deps, verificado.sessao, outra.id, origem);
    expect(await cenario.tokens.verificar(novo.tokenAcesso)).toMatchObject({
      sessao: { empresaId: outra.id },
    });
    expect(usuario.empresaPreferidaId).toBe(outra.id);
    expect(cenario.banco.auditoria.at(-1)).toMatchObject({
      acao: "trocar_empresa",
      empresaId: outra.id,
    });
  });
});

describe("senha por e-mail", () => {
  it("e-mail desconhecido não recebe nada", async () => {
    await pedirRedefinicao(cenario.deps, "ninguem@fr.com.br");
    expect(cenario.correio.enviados).toEqual([]);
  });

  it("link de uso único redefine a senha e derruba as sessões abertas", async () => {
    const { usuario } = await preparar();
    const aberta = await entrar(cenario.deps, { email: usuario.email, senha: SENHA }, origem);
    await pedirRedefinicao(cenario.deps, usuario.email);

    const [email] = cenario.correio.enviados;
    expect(email?.assunto).toContain("Redefinir");
    const token =
      new URL(/http\S+/.exec(email?.texto ?? "")?.[0] ?? "").searchParams.get("token") ?? "";

    const entrada = { tipo: "redefinicao" as const, token, senha: "nova-senha-456", nome: null };
    await definirSenhaPorToken(cenario.deps, entrada, origem);
    await expect(definirSenhaPorToken(cenario.deps, entrada, origem)).rejects.toMatchObject({
      codigo: "ENTRADA_INVALIDA",
    });
    await expect(renovar(cenario.deps, aberta.refresh.token, origem)).rejects.toMatchObject({
      codigo: "SESSAO_EXPIRADA",
    });
    await expect(
      entrar(cenario.deps, { email: usuario.email, senha: "nova-senha-456" }, origem),
    ).resolves.toBeDefined();
  });

  it("link vencido é recusado", async () => {
    const { usuario } = await preparar();
    await pedirRedefinicao(cenario.deps, usuario.email);
    const token = /token=([\w-]+)/.exec(cenario.correio.enviados[0]?.texto ?? "")?.[1] ?? "";
    cenario.relogio.avancar(61 * 60_000);
    await expect(
      definirSenhaPorToken(
        cenario.deps,
        { tipo: "redefinicao", token, senha: "x".repeat(8), nome: null },
        origem,
      ),
    ).rejects.toThrow("Link inválido ou expirado");
  });

  it("convite define senha e nome", async () => {
    const usuario = cenario.banco.criarUsuario({ email: "novo@fr.com.br" });
    cenario.banco.tokensSenha.push({
      id: "t1",
      usuarioId: usuario.id,
      tipo: "convite",
      tokenHash: hashDoToken("token-do-convite-com-mais-de-20"),
      expiraEm: new Date("2026-11-17T00:00:00Z"),
      usadoEm: null,
    });
    await definirSenhaPorToken(
      cenario.deps,
      { tipo: "convite", token: "token-do-convite-com-mais-de-20", senha: SENHA, nome: "Novo" },
      origem,
    );
    expect(usuario).toMatchObject({ nome: "Novo", senhaAlgoritmo: "argon2id" });
    expect(cenario.banco.auditoria.at(-1)?.acao).toBe("aceitar_convite");
  });
});

describe("Google", () => {
  const identidade = { sujeito: "google-1", email: "Joana@fr.com.br", emailVerificado: true };

  it("só entra quem já é usuário, com e-mail verificado", async () => {
    await expect(entrarComGoogle(cenario.deps, identidade, origem)).resolves.toBeNull();
    await preparar();
    await expect(
      entrarComGoogle(cenario.deps, { ...identidade, emailVerificado: false }, origem),
    ).resolves.toBeNull();
    await expect(entrarComGoogle(cenario.deps, identidade, origem)).resolves.toMatchObject({
      expiraEmSegundos: 900,
    });
    expect(cenario.banco.identidades).toMatchObject([{ provedor: "google", sujeito: "google-1" }]);
  });
});

describe("ajuda de acesso", () => {
  it("lista quem pode liberar na empresa ativa", async () => {
    const { empresa, usuario } = await preparar();
    const operador = await usuarioComSenha(cenario, "op@fr.com.br", SENHA);
    cenario.banco.vincular(operador.id, empresa.id, { papel: "operador" });
    const sessao = await entrar(cenario.deps, { email: operador.email, senha: SENHA }, origem);
    const verificado = await cenario.tokens.verificar(sessao.tokenAcesso);
    if (!verificado.valido) throw new Error("token inválido");

    const ajuda = await ajudaDeAcesso(cenario.deps, verificado.sessao);
    expect(ajuda.admins).toEqual([{ nome: usuario.nome, email: usuario.email }]);
    expect(ajuda.email).toBe("op@fr.com.br");
  });
});
