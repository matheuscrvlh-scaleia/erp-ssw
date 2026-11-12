import { PERMISSOES_GRAVAVEIS } from "@erp/shared/acesso/permissoes";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cenarioDeAdmin } from "../../testes/admin";

let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
beforeEach(async () => {
  t = await cenarioDeAdmin();
});
afterEach(() => t.app.close());

describe("cargos (grupos com permissões) por empresa", () => {
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
      payload: { chave: "Com Espaço", rotulo: "X", permissoes: [] },
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
      payload: {
        chave: "conferente",
        rotulo: "Conferente",
        permissoes: ["ranking.ver", "ranking_novo.ver"],
      },
    });
    expect(criado.statusCode).toBe(200);
    const alterado = await t.app.inject({
      method: "PUT",
      url: "/api/v1/admin/cargos/conferente",
      headers,
      payload: {
        rotulo: "Conferente II",
        permissoes: ["romaneio.ver", "calendario.ver", "calendario.editar"],
      },
    });
    expect(alterado.statusCode).toBe(200);
    expect(t.banco.cargos.get(`${t.empresaA.id}:conferente`)).toMatchObject({
      rotulo: "Conferente II",
      permissoes: ["romaneio.ver", "calendario.ver", "calendario.editar"],
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

  it("permissão da Plataforma, dada por regra ou fora do catálogo não entra em cargo", async () => {
    const { headers } = await t.comoPapel("admin");
    for (const p of ["plataforma_empresas.ver", "admin_logs.ver", "admin_ingestao.ver", "x.ver"]) {
      const r = await t.app.inject({
        method: "POST",
        url: "/api/v1/admin/cargos",
        headers,
        payload: { chave: "espiao", rotulo: "Espião", permissoes: [p] },
      });
      expect(r.statusCode).toBe(422);
    }
  });

  it("Admin e Super Admin: tudo, só o nome muda e não saem; cargo em uso não sai", async () => {
    const { headers } = await t.comoPapel("admin");
    await t.app.inject({
      method: "PUT",
      url: "/api/v1/admin/cargos/super_admin",
      headers,
      payload: { rotulo: "Dono", permissoes: ["performance.ver"] },
    });
    const lista = await t.app.inject({ url: "/api/v1/admin/cargos", headers });
    const dono = lista
      .json<{
        cargos: { chave: string; rotulo: string; temTudo: boolean; permissoes: string[] }[];
      }>()
      .cargos.find((c) => c.chave === "super_admin");
    expect(dono).toMatchObject({ rotulo: "Dono", temTudo: true });
    expect(dono?.permissoes).toEqual(PERMISSOES_GRAVAVEIS);

    for (const chave of ["super_admin", "admin"]) {
      const r = await t.app.inject({
        method: "DELETE",
        url: `/api/v1/admin/cargos/${chave}`,
        headers,
      });
      expect(r.json()).toEqual({
        erro: { codigo: "CONFLITO", mensagem: "Este cargo é protegido" },
      });
    }
    const emUso = await t.app.inject({
      method: "DELETE",
      url: "/api/v1/admin/cargos/operador",
      headers,
    });
    expect(emUso.statusCode).toBe(200);
    await t.comoPapel("gestor_x");
    t.banco.definirCargo(t.empresaA.id, "gestor_x", { rotulo: "Gestor X" });
    const usado = await t.app.inject({
      method: "DELETE",
      url: "/api/v1/admin/cargos/gestor_x",
      headers,
    });
    expect(usado.json()).toEqual({
      erro: { codigo: "CONFLITO", mensagem: "Cargo em uso por 1 usuário(s)" },
    });
  });

  it("chave repetida é conflito, mesmo a de um cargo com tudo", async () => {
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/cargos",
      headers,
      payload: { chave: "operador", rotulo: "De novo", permissoes: [] },
    });
    expect(r.statusCode).toBe(409);
  });

  it("gravar exige a ação: Ver em Cargos não basta para criar", async () => {
    const { headers } = await t.comoPapel("admin");
    t.banco.excecoes.push({
      empresaId: t.empresaA.id,
      usuarioId: t.banco.usuarios.at(-1)?.id ?? "",
      permissao: "admin_roles.editar",
      efeito: "nega",
    });
    const r = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/cargos",
      headers,
      payload: { chave: "novo", rotulo: "Novo", permissoes: [] },
    });
    expect(r.statusCode).toBe(403);
    expect((await t.app.inject({ url: "/api/v1/admin/cargos", headers })).statusCode).toBe(200);
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
