import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cenarioDeAdmin } from "../../testes/admin";

let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
beforeEach(async () => {
  t = await cenarioDeAdmin();
});
afterEach(() => t.app.close());

describe("cargos (Roles) por empresa", () => {
  it("401, 403 para operador e 422 com chave inválida", async () => {
    expect((await t.app.inject({ url: "/api/v1/admin/cargos" })).statusCode).toBe(401);
    const operador = await t.comoPapel("operador");
    const negado = await t.app.inject({ url: "/api/v1/admin/cargos", headers: operador.headers });
    expect(negado.statusCode).toBe(403);
    const { headers } = await t.comoPapel("admin");
    const invalido = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/cargos",
      headers,
      payload: { chave: "Com Espaço", rotulo: "X", telas: [] },
    });
    expect(invalido.statusCode).toBe(422);
  });

  it("cria, altera e exclui cargo da empresa ativa sem tocar no da outra; registra em Logs", async () => {
    const { headers } = await t.comoPapel("admin");
    t.banco.definirCargo(t.empresaB.id, "conferente", { rotulo: "Da B", telas: ["romaneio"] });

    const criado = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/cargos",
      headers,
      payload: { chave: "conferente", rotulo: "Conferente", telas: ["ranking", "ranking_novo"] },
    });
    expect(criado.statusCode).toBe(200);
    const alterado = await t.app.inject({
      method: "PUT",
      url: "/api/v1/admin/cargos/conferente",
      headers,
      payload: { rotulo: "Conferente II", telas: ["romaneio"] },
    });
    expect(alterado.statusCode).toBe(200);
    expect(t.banco.cargos.get(`${t.empresaA.id}:conferente`)).toMatchObject({
      rotulo: "Conferente II",
      telas: ["romaneio"],
    });
    const excluido = await t.app.inject({
      method: "DELETE",
      url: "/api/v1/admin/cargos/conferente",
      headers,
    });
    expect(excluido.statusCode).toBe(200);
    expect(t.banco.cargos.has(`${t.empresaA.id}:conferente`)).toBe(false);
    expect(t.banco.cargos.get(`${t.empresaB.id}:conferente`)?.rotulo).toBe("Da B");
    expect(t.banco.auditoria.map((a) => [a.entidade, a.acao, a.empresaId])).toEqual([
      ["cargo", "criar", t.empresaA.id],
      ["cargo", "alterar", t.empresaA.id],
      ["cargo", "excluir", t.empresaA.id],
    ]);
  });

  it("tela da Plataforma ou dada por regra não entra em cargo", async () => {
    const { headers } = await t.comoPapel("admin");
    for (const tela of ["plataforma_empresas", "admin_logs", "admin_ingestao"]) {
      const r = await t.app.inject({
        method: "POST",
        url: "/api/v1/admin/cargos",
        headers,
        payload: { chave: "espiao", rotulo: "Espião", telas: [tela] },
      });
      expect(r.statusCode).toBe(422);
    }
  });

  it("cargo protegido não perde telas nem sai; cargo em uso não sai", async () => {
    const { headers } = await t.comoPapel("admin");
    const telasAntes = t.banco.cargos.get(`${t.empresaA.id}:super_admin`)?.telas;
    await t.app.inject({
      method: "PUT",
      url: "/api/v1/admin/cargos/super_admin",
      headers,
      payload: { rotulo: "Dono", telas: [] },
    });
    expect(t.banco.cargos.get(`${t.empresaA.id}:super_admin`)).toMatchObject({
      rotulo: "Dono",
      telas: telasAntes,
    });
    const protegido = await t.app.inject({
      method: "DELETE",
      url: "/api/v1/admin/cargos/super_admin",
      headers,
    });
    expect(protegido.json()).toEqual({
      erro: { codigo: "CONFLITO", mensagem: "Este role é protegido" },
    });
    const emUso = await t.app.inject({
      method: "DELETE",
      url: "/api/v1/admin/cargos/admin",
      headers,
    });
    expect(emUso.json()).toEqual({
      erro: { codigo: "CONFLITO", mensagem: "Role em uso por 1 usuário(s)" },
    });
  });

  it("lista conta só os usuários da empresa ativa", async () => {
    const { headers } = await t.comoPapel("admin");
    await t.comoPapel("admin", t.empresaB.id);
    const r = await t.app.inject({ url: "/api/v1/admin/cargos", headers });
    const admin = r
      .json<{ cargos: { chave: string; usuarios: number }[] }>()
      .cargos.find((c) => c.chave === "admin");
    expect(admin?.usuarios).toBe(1);
  });
});

describe("departamentos por empresa", () => {
  it("cria, lista, altera e exclui; chave repetida na mesma empresa é conflito", async () => {
    const { headers } = await t.comoPapel("admin");
    const payload = { chave: "expedicao", rotulo: "Expedição", descricao: "", telas: ["romaneio"] };
    const criado = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/departamentos",
      headers,
      payload,
    });
    expect(criado.statusCode).toBe(200);
    const repetido = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/departamentos",
      headers,
      payload,
    });
    expect(repetido.statusCode).toBe(409);

    // A mesma chave em outra empresa é outro departamento (Q30).
    const outra = await t.comoPapel("admin", t.empresaB.id);
    const naB = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/departamentos",
      headers: outra.headers,
      payload,
    });
    expect(naB.statusCode).toBe(200);

    const alterado = await t.app.inject({
      method: "PUT",
      url: "/api/v1/admin/departamentos/expedicao",
      headers,
      payload: { rotulo: "Expedição SP", descricao: "SP", ativo: false, telas: [] },
    });
    expect(alterado.statusCode).toBe(200);
    const lista = await t.app.inject({ url: "/api/v1/admin/departamentos", headers });
    expect(lista.json()).toMatchObject({
      departamentos: [{ chave: "expedicao", rotulo: "Expedição SP", ativo: false, telas: [] }],
    });
    const excluido = await t.app.inject({
      method: "DELETE",
      url: "/api/v1/admin/departamentos/expedicao",
      headers,
    });
    expect(excluido.statusCode).toBe(200);
    expect(t.banco.adm.departamentos.map((d) => d.empresaId)).toEqual([t.empresaB.id]);
  });

  it("404 para departamento de outra empresa", async () => {
    t.banco.adm.departamentos.push({
      empresaId: t.empresaB.id,
      chave: "so_da_b",
      rotulo: "Só da B",
      descricao: null,
      ativo: true,
      protegido: false,
    });
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({
      method: "DELETE",
      url: "/api/v1/admin/departamentos/so_da_b",
      headers,
    });
    expect(r.statusCode).toBe(404);
    expect(t.banco.adm.departamentos).toHaveLength(1);
  });
});
