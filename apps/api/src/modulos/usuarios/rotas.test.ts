import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashDoToken } from "../../infra/aleatorio";
import { cenarioDeAdmin } from "../../testes/admin";

let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
beforeEach(async () => {
  t = await cenarioDeAdmin();
});
afterEach(() => t.app.close());

const CONVITE = {
  modo: "convite",
  email: " Nova.Pessoa@FR.com.br ",
  nome: "Nova Pessoa",
  papel: "operador",
};

describe("GET /api/v1/admin/usuarios", () => {
  it("401 sem sessão e 403 para operador", async () => {
    expect((await t.app.inject({ url: "/api/v1/admin/usuarios" })).statusCode).toBe(401);
    const { headers } = await t.comoPapel("operador");
    const r = await t.app.inject({ url: "/api/v1/admin/usuarios", headers });
    expect(r.statusCode).toBe(403);
    expect(r.json()).toEqual({
      erro: { codigo: "SEM_PERMISSAO", mensagem: "Acesso restrito a administradores" },
    });
  });

  it("lista só os usuários da empresa ativa, com exceções", async () => {
    const { headers } = await t.comoPapel("admin");
    const deFora = t.banco.criarUsuario({ email: "fora@outra.com.br" });
    t.banco.vincular(deFora.id, t.empresaB.id, { papel: "admin" });
    const r = await t.app.inject({ url: "/api/v1/admin/usuarios", headers });
    expect(r.statusCode).toBe(200);
    const emails = r.json<{ usuarios: { email: string }[] }>().usuarios.map((u) => u.email);
    expect(emails).not.toContain("fora@outra.com.br");
    expect(t.banco.contextos.at(-1)).toMatchObject({ empresaId: t.empresaA.id });
  });
});

describe("POST /api/v1/admin/usuarios (convite)", () => {
  it("cria conta e vínculo com o cargo, manda o link de uso único e registra em Logs", async () => {
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers,
      payload: CONVITE,
    });
    expect(r.statusCode).toBe(200);
    const { id } = r.json<{ id: string }>();
    const conta = t.banco.usuarios.find((u) => u.id === id);
    expect(conta).toMatchObject({ email: "nova.pessoa@fr.com.br", senhaHash: null });
    expect(t.banco.vinculos.find((v) => v.usuarioId === id)).toMatchObject({
      empresaId: t.empresaA.id,
      papel: "operador",
      ativo: true,
    });
    expect(t.banco.excecoes).toEqual([]);

    const [email] = t.cenario.correio.enviados;
    expect(email?.para).toBe("nova.pessoa@fr.com.br");
    const link = /http:\/\/localhost:5173\/aceitar-convite\?token=([\w-]+)/.exec(
      email?.texto ?? "",
    );
    expect(link).not.toBeNull();
    const token = t.banco.tokensSenha.find((k) => k.usuarioId === id);
    expect(token?.tipo).toBe("convite");
    expect(token?.tokenHash).toBe(hashDoToken(link?.[1] ?? ""));
    expect(JSON.stringify(t.banco.tokensSenha)).not.toContain(link?.[1]);

    expect(t.banco.auditoria.at(-1)).toMatchObject({
      empresaId: t.empresaA.id,
      acao: "convidar",
      entidade: "usuario",
      resumo: "Convite para nova.pessoa@fr.com.br",
    });
  });

  it("o convite aceito cria a senha e o usuário entra", async () => {
    const { headers } = await t.comoPapel("admin");
    await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers,
      payload: CONVITE,
    });
    const token = /token=([\w-]+)/.exec(t.cenario.correio.enviados[0]?.texto ?? "")?.[1];
    const aceite = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/convite/aceitar",
      payload: { token, senha: "senha-nova-123" },
    });
    expect(aceite.statusCode).toBe(200);
    const login = await t.app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nova.pessoa@fr.com.br", senha: "senha-nova-123" },
    });
    expect(login.statusCode).toBe(200);
  });

  it("tudo ou nada: se o e-mail não sai, nada fica gravado (Q36)", async () => {
    const { headers } = await t.comoPapel("admin");
    t.cenario.correio.enviar = () => Promise.reject(new Error("SMTP fora"));
    const antes = t.banco.usuarios.length;
    const r = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers,
      payload: CONVITE,
    });
    expect(r.statusCode).toBe(500);
    expect(t.banco.usuarios).toHaveLength(antes);
    expect(t.banco.auditoria.some((a) => a.acao === "convidar")).toBe(false);
  });

  it("com senha: grava argon2id, não manda e-mail; 422 com senha curta", async () => {
    const { headers } = await t.comoPapel("admin");
    const curta = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers,
      payload: { ...CONVITE, modo: "senha", senha: "123" },
    });
    expect(curta.statusCode).toBe(422);
    const r = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers,
      payload: { ...CONVITE, modo: "senha", senha: "senha-forte-1" },
    });
    expect(r.statusCode).toBe(200);
    expect(t.cenario.correio.enviados).toHaveLength(0);
    const conta = t.banco.usuarios.find((u) => u.id === r.json<{ id: string }>().id);
    expect(conta?.senhaAlgoritmo).toBe("argon2id");
    expect(t.banco.auditoria.at(-1)?.resumo).toBe("Usuário nova.pessoa@fr.com.br criado com senha");
    expect(JSON.stringify(t.banco.auditoria)).not.toContain("senha-forte-1");
  });

  it("recusa cargo de outra empresa e e-mail repetido", async () => {
    const { headers } = await t.comoPapel("admin");
    t.banco.definirCargo(t.empresaB.id, "so_da_b", { rotulo: "Só da B", telas: [] });
    const papelDeFora = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers,
      payload: { ...CONVITE, papel: "so_da_b" },
    });
    expect(papelDeFora.json()).toEqual({
      erro: { codigo: "ENTRADA_INVALIDA", mensagem: "Cargo inexistente" },
    });

    t.banco.criarUsuario({ email: "nova.pessoa@fr.com.br" });
    const repetido = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers,
      payload: CONVITE,
    });
    expect(repetido.statusCode).toBe(409);
  });

  it("admin não cria Super Admin; o Super Admin cria", async () => {
    const admin = await t.comoPapel("admin");
    const negado = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers: admin.headers,
      payload: { ...CONVITE, papel: "super_admin" },
    });
    expect(negado.statusCode).toBe(403);
    const superAdmin = await t.comoPapel("super_admin");
    const aceito = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/usuarios",
      headers: superAdmin.headers,
      payload: { ...CONVITE, papel: "super_admin" },
    });
    expect(aceito.statusCode).toBe(200);
  });
});

describe("PUT /api/v1/admin/usuarios/:id", () => {
  const edicao = (email: string) => ({
    nome: "Pessoa",
    email,
    papel: "operador",
    ativo: true,
  });

  it("admin de uma empresa não altera usuário de outra (404, nada muda)", async () => {
    const { headers } = await t.comoPapel("admin");
    const deFora = t.banco.criarUsuario({ email: "fora@outra.com.br", nome: "Fora" });
    t.banco.vincular(deFora.id, t.empresaB.id, { papel: "admin" });
    const r = await t.app.inject({
      method: "PUT",
      url: `/api/v1/admin/usuarios/${deFora.id}`,
      headers,
      payload: edicao("trocado@x.com"),
    });
    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({
      erro: { codigo: "NAO_ENCONTRADO", mensagem: "Usuário não pertence à empresa ativa." },
    });
    expect(deFora.email).toBe("fora@outra.com.br");
    expect(t.banco.vinculos.find((v) => v.usuarioId === deFora.id)?.papel).toBe("admin");
  });

  it("e-mail de quem também está em outra empresa só a Plataforma muda", async () => {
    const { headers } = await t.comoPapel("admin");
    const duplo = t.banco.criarUsuario({ email: "duplo@fr.com.br", nome: "Pessoa" });
    t.banco.vincular(duplo.id, t.empresaA.id, { papel: "operador" });
    t.banco.vincular(duplo.id, t.empresaB.id, { papel: "admin" });
    const r = await t.app.inject({
      method: "PUT",
      url: `/api/v1/admin/usuarios/${duplo.id}`,
      headers,
      payload: edicao("roubado@x.com"),
    });
    expect(r.statusCode).toBe(403);
    expect(duplo.email).toBe("duplo@fr.com.br");
  });

  it("admin de empresa não troca o e-mail de alguém da equipe da Plataforma", async () => {
    const { headers } = await t.comoPapel("admin");
    const daPlataforma = t.banco.criarUsuario({ email: "time@scale.ia", nome: "Pessoa" });
    t.banco.plataformaAdmins.add(daPlataforma.id);
    t.banco.vincular(daPlataforma.id, t.empresaA.id, { papel: "operador" });
    const r = await t.app.inject({
      method: "PUT",
      url: `/api/v1/admin/usuarios/${daPlataforma.id}`,
      headers,
      payload: edicao("atacante@x.com"),
    });
    expect(r.statusCode).toBe(403);
    expect(daPlataforma.email).toBe("time@scale.ia");
  });

  it("admin comum não desativa Super Admin nem quem é da Plataforma; Super Admin desativa", async () => {
    const { headers } = await t.comoPapel("admin");
    const chefe = t.banco.criarUsuario({ email: "chefe@fr.com.br", nome: "Pessoa" });
    t.banco.vincular(chefe.id, t.empresaA.id, { papel: "super_admin" });
    const daPlataforma = t.banco.criarUsuario({ email: "time@scale.ia", nome: "Pessoa" });
    t.banco.plataformaAdmins.add(daPlataforma.id);
    t.banco.vincular(daPlataforma.id, t.empresaA.id, { papel: "operador" });
    const desativar = (id: string, email: string, h: Record<string, string>, papel = "operador") =>
      t.app.inject({
        method: "PUT",
        url: `/api/v1/admin/usuarios/${id}`,
        headers: h,
        payload: { ...edicao(email), papel, ativo: false },
      });

    const r1 = await desativar(chefe.id, "chefe@fr.com.br", headers, "super_admin");
    expect(r1.statusCode).toBe(403);
    expect(r1.json()).toMatchObject({
      erro: { mensagem: "Apenas o Super Admin pode desativar ou reativar um Super Admin." },
    });
    const r2 = await desativar(daPlataforma.id, "time@scale.ia", headers);
    expect(r2.statusCode).toBe(403);
    expect(chefe.ativo).toBe(true);
    expect(daPlataforma.ativo).toBe(true);
    expect(t.banco.vinculos.filter((v) => !v.ativo)).toEqual([]);

    const superAdmin = await t.comoPapel("super_admin");
    const r3 = await desativar(chefe.id, "chefe@fr.com.br", superAdmin.headers, "super_admin");
    expect(r3.statusCode).toBe(200);
    expect(t.banco.vinculos.find((v) => v.usuarioId === chefe.id)?.ativo).toBe(false);
  });

  it("troca o cargo e o ativo do vínculo e registra a mudança", async () => {
    const { headers } = await t.comoPapel("admin");
    const pessoa = t.banco.criarUsuario({ email: "p@fr.com.br", nome: "Pessoa" });
    t.banco.vincular(pessoa.id, t.empresaA.id, { papel: "operador" });
    const r = await t.app.inject({
      method: "PUT",
      url: `/api/v1/admin/usuarios/${pessoa.id}`,
      headers,
      payload: {
        ...edicao("p@fr.com.br"),
        papel: "admin",
        ativo: false,
      },
    });
    expect(r.statusCode).toBe(200);
    expect(pessoa.ativo).toBe(false);
    expect(t.banco.auditoria.find((a) => a.entidade === "usuario_empresa")).toMatchObject({
      antes: { papel: "operador", ativo: true },
      depois: { papel: "admin", ativo: false },
    });
  });
});

describe("PUT /api/v1/admin/usuarios/:id/permissoes (exceções)", () => {
  const url = (id: string) => `/api/v1/admin/usuarios/${id}/permissoes`;

  it("grava Sim e Não, troca as anteriores e registra em Logs; vale no acesso da pessoa", async () => {
    const { headers } = await t.comoPapel("admin");
    const pessoa = await t.comoPapel("operador");
    const r = await t.app.inject({
      method: "PUT",
      url: url(pessoa.usuario.id),
      headers,
      payload: {
        excecoes: [
          { permissao: "coletas.ver", efeito: "concede" },
          { permissao: "performance.ver", efeito: "nega" },
        ],
      },
    });
    expect(r.statusCode).toBe(200);
    expect(t.banco.excecoes.map((e) => [e.permissao, e.efeito])).toEqual([
      ["coletas.ver", "concede"],
      ["performance.ver", "nega"],
    ]);
    expect(t.banco.auditoria.at(-1)).toMatchObject({
      entidade: "permissao_usuario",
      entidadeId: pessoa.usuario.id,
      depois: { "coletas.ver": "Sim", "performance.ver": "Não" },
    });
    t.banco.liberarModulo(t.empresaA.id, "coletas");
    t.banco.liberarModulo(t.empresaA.id, "performance");
    const eu = await t.app.inject({ url: "/api/v1/auth/me", headers: pessoa.headers });
    expect(eu.json<{ telas: string[] }>().telas).toEqual(["coletas"]);

    await t.app.inject({
      method: "PUT",
      url: url(pessoa.usuario.id),
      headers,
      payload: { excecoes: [] },
    });
    expect(t.banco.excecoes).toEqual([]);
  });

  it("só admin ajusta, ninguém ajusta as próprias e Sim e Não juntos é recusado", async () => {
    const admin = await t.comoPapel("admin");
    const operador = await t.comoPapel("operador");
    t.banco.definirCargo(t.empresaA.id, "operador", {
      rotulo: "Operador",
      telas: ["performance", "admin_usuarios"],
    });
    const peloOperador = await t.app.inject({
      method: "PUT",
      url: url(admin.usuario.id),
      headers: operador.headers,
      payload: { excecoes: [] },
    });
    expect(peloOperador.statusCode).toBe(403);
    const asProprias = await t.app.inject({
      method: "PUT",
      url: url(admin.usuario.id),
      headers: admin.headers,
      payload: { excecoes: [{ permissao: "coletas.ver", efeito: "nega" }] },
    });
    expect(asProprias.json()).toEqual({
      erro: {
        codigo: "SEM_PERMISSAO",
        mensagem: "Você não pode ajustar as suas próprias permissões.",
      },
    });
    const conflitante = await t.app.inject({
      method: "PUT",
      url: url(operador.usuario.id),
      headers: admin.headers,
      payload: {
        excecoes: [
          { permissao: "coletas.ver", efeito: "concede" },
          { permissao: "coletas.ver", efeito: "nega" },
        ],
      },
    });
    expect(conflitante.statusCode).toBe(422);
    const daPlataforma = await t.app.inject({
      method: "PUT",
      url: url(operador.usuario.id),
      headers: admin.headers,
      payload: { excecoes: [{ permissao: "plataforma_empresas.ver", efeito: "concede" }] },
    });
    expect(daPlataforma.statusCode).toBe(422);
    expect(t.banco.excecoes).toEqual([]);
  });

  it("404 para pessoa de outra empresa", async () => {
    const { headers } = await t.comoPapel("admin");
    const deFora = await t.comoPapel("operador", t.empresaB.id);
    const r = await t.app.inject({
      method: "PUT",
      url: url(deFora.usuario.id),
      headers,
      payload: { excecoes: [{ permissao: "coletas.ver", efeito: "concede" }] },
    });
    expect(r.statusCode).toBe(404);
  });
});

describe("senha e reenvio de convite", () => {
  it("definir senha: grava, derruba as sessões, registra sem o valor", async () => {
    const { headers } = await t.comoPapel("admin");
    const pessoa = t.banco.criarUsuario({ email: "p@fr.com.br" });
    t.banco.vincular(pessoa.id, t.empresaA.id, { papel: "operador" });
    await import("../../testes/cenario").then(({ entrarComo }) =>
      entrarComo(t.cenario, pessoa.id, t.empresaA.id),
    );
    const r = await t.app.inject({
      method: "PUT",
      url: `/api/v1/admin/usuarios/${pessoa.id}/senha`,
      headers,
      payload: { senha: "nova-senha-123" },
    });
    expect(r.statusCode).toBe(200);
    expect(pessoa.senhaAlgoritmo).toBe("argon2id");
    expect(
      t.banco.sessoes.filter((s) => s.usuarioId === pessoa.id).every((s) => s.revogadaEm),
    ).toBe(true);
    expect(t.banco.auditoria.at(-1)).toMatchObject({
      acao: "definir_senha",
      entidadeId: pessoa.id,
    });
    expect(JSON.stringify(t.banco.auditoria)).not.toContain("nova-senha-123");
  });

  it("senha de Super Admin: admin não; Plataforma sozinha também não", async () => {
    const alvo = t.banco.criarUsuario({ email: "chefe@fr.com.br" });
    t.banco.vincular(alvo.id, t.empresaA.id, { papel: "super_admin" });
    for (const { headers } of [await t.comoPapel("admin"), await t.comoPlataforma()]) {
      const r = await t.app.inject({
        method: "PUT",
        url: `/api/v1/admin/usuarios/${alvo.id}/senha`,
        headers,
        payload: { senha: "nova-senha-123" },
      });
      expect(r.statusCode).toBe(403);
    }
    expect(alvo.senhaHash).toBeNull();
  });

  it("reenviar convite: só para quem ainda não criou a senha", async () => {
    const { headers } = await t.comoPapel("admin");
    const pendente = t.banco.criarUsuario({ email: "pendente@fr.com.br" });
    t.banco.vincular(pendente.id, t.empresaA.id, { papel: "operador" });
    const r = await t.app.inject({
      method: "POST",
      url: `/api/v1/admin/usuarios/${pendente.id}/convite`,
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(t.cenario.correio.enviados.at(-1)?.para).toBe("pendente@fr.com.br");
    expect(t.banco.auditoria.at(-1)?.acao).toBe("reenviar_convite");

    pendente.senhaHash = "x";
    pendente.senhaAlgoritmo = "argon2id";
    const jaTem = await t.app.inject({
      method: "POST",
      url: `/api/v1/admin/usuarios/${pendente.id}/convite`,
      headers,
    });
    expect(jaTem.statusCode).toBe(409);
  });
});
