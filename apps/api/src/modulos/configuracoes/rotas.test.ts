import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cenarioDeAdmin } from "../../testes/admin";

let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
beforeEach(async () => {
  t = await cenarioDeAdmin();
  for (const empresa of [t.empresaA, t.empresaB]) {
    t.banco.adm.configuracoes.push(
      {
        empresaId: empresa.id,
        chave: "sla_meta_pct",
        valor: empresa === t.empresaA ? "95" : "80",
        descricao: "Meta",
        grupo: "performance",
        atualizadoEm: new Date("2026-01-01"),
        atualizadoPor: null,
      },
      {
        empresaId: empresa.id,
        chave: "whatsapp_horario_envio",
        valor: "08:00",
        descricao: "Horário",
        grupo: "notificacoes",
        atualizadoEm: new Date("2026-01-01"),
        atualizadoPor: null,
      },
      {
        empresaId: empresa.id,
        chave: "edge_apikey",
        valor: "nao-mostrar",
        descricao: "Infra",
        grupo: "empresa",
        atualizadoEm: new Date("2026-01-01"),
        atualizadoPor: null,
      },
    );
  }
});
afterEach(() => t.app.close());

describe("Admin › Configurações", () => {
  it("401, 403 para operador; lista só os grupos editáveis da empresa ativa", async () => {
    expect((await t.app.inject({ url: "/api/v1/admin/configuracoes" })).statusCode).toBe(401);
    const operador = await t.comoPapel("operador");
    expect(
      (await t.app.inject({ url: "/api/v1/admin/configuracoes", headers: operador.headers }))
        .statusCode,
    ).toBe(403);
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({ url: "/api/v1/admin/configuracoes", headers });
    expect(r.json<{ configuracoes: { chave: string; valor: string }[] }>().configuracoes).toEqual([
      expect.objectContaining({ chave: "whatsapp_horario_envio" }),
      expect.objectContaining({ chave: "sla_meta_pct", valor: "95" }),
    ]);
    expect(r.body).not.toContain("nao-mostrar");
  });

  it("salva o grupo com o valor normalizado, registra e invalida o cache das públicas", async () => {
    const { headers } = await t.comoPapel("admin");
    const antes = await t.app.inject({ url: "/api/v1/configuracoes/publicas", headers });
    expect(antes.json()).toEqual({ valores: { sla_meta_pct: "95" } });

    const r = await t.app.inject({
      method: "PUT",
      url: "/api/v1/admin/configuracoes/performance",
      headers,
      payload: { itens: [{ chave: "sla_meta_pct", valor: " 92.0 " }] },
    });
    expect(r.json()).toEqual({ atualizados: 1 });
    expect(t.banco.auditoria.at(-1)).toMatchObject({
      entidade: "configuracao",
      entidadeId: "sla_meta_pct",
      antes: { valor: "95" },
      depois: { valor: "92" },
    });
    const depois = await t.app.inject({ url: "/api/v1/configuracoes/publicas", headers });
    expect(depois.json()).toEqual({ valores: { sla_meta_pct: "92" } });
    const daOutra = t.banco.adm.configuracoes.find(
      (c) => c.empresaId === t.empresaB.id && c.chave === "sla_meta_pct",
    );
    expect(daOutra?.valor).toBe("80");
  });

  it("422: chave de outro grupo, chave inexistente e valor inválido", async () => {
    const { headers } = await t.comoPapel("admin");
    const casos = [
      [{ chave: "whatsapp_horario_envio", valor: "08:00" }, "não pertence ao grupo performance"],
      [{ chave: "nao_existe", valor: "1" }, 'Configuração "nao_existe" não existe'],
      [{ chave: "sla_meta_pct", valor: "120" }, "deve estar entre 0 e 100"],
    ] as const;
    for (const [item, mensagem] of casos) {
      const r = await t.app.inject({
        method: "PUT",
        url: "/api/v1/admin/configuracoes/performance",
        headers,
        payload: { itens: [item] },
      });
      expect(r.statusCode).toBe(422);
      expect(r.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain(mensagem);
    }
  });

  it("públicas: qualquer usuário da empresa lê só as da empresa dele", async () => {
    const operadorB = await t.comoPapel("operador", t.empresaB.id);
    const r = await t.app.inject({
      url: "/api/v1/configuracoes/publicas",
      headers: operadorB.headers,
    });
    expect(r.json()).toEqual({ valores: { sla_meta_pct: "80" } });
  });
});
