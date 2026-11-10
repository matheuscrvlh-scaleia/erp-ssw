import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cenarioDeAdmin } from "../../testes/admin";

let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
beforeEach(async () => {
  t = await cenarioDeAdmin();
});
afterEach(() => t.app.close());

const REGRA = {
  tipo: "parceiro",
  parceiroCnpj: "12.345.678/0001-90",
  parceiroNome: "P",
  prazoDias: 3,
};

describe("Admin › Prazos configurados", () => {
  it("401, 403 para operador, 422 sem os campos do tipo", async () => {
    expect((await t.app.inject({ url: "/api/v1/admin/prazos-configurados" })).statusCode).toBe(401);
    const operador = await t.comoPapel("operador");
    const negado = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/prazos-configurados",
      headers: operador.headers,
      payload: REGRA,
    });
    expect(negado.statusCode).toBe(403);
    const { headers } = await t.comoPapel("admin");
    const incompleta = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/prazos-configurados",
      headers,
      payload: { tipo: "unidade", unidadeCodigo: "CAP" },
    });
    expect(incompleta.json()).toEqual({
      erro: { codigo: "ENTRADA_INVALIDA", mensagem: "Unidade e horas são obrigatórias" },
    });
  });

  it("cria, liga/desliga, altera e apaga; cada um enfileira o recálculo da empresa ativa", async () => {
    const { headers } = await t.comoPapel("admin");
    const criada = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/prazos-configurados",
      headers,
      payload: REGRA,
    });
    expect(criada.statusCode).toBe(200);
    const { id, recalculoAgendado } = criada.json<{ id: string; recalculoAgendado: boolean }>();
    expect(recalculoAgendado).toBe(true);

    const repetida = await t.app.inject({
      method: "POST",
      url: "/api/v1/admin/prazos-configurados",
      headers,
      payload: REGRA,
    });
    expect(repetida.statusCode).toBe(409);

    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/admin/prazos-configurados/${id}`,
      headers,
      payload: { ativo: false },
    });
    await t.app.inject({
      method: "PUT",
      url: `/api/v1/admin/prazos-configurados/${id}`,
      headers,
      payload: { ...REGRA, prazoDias: 5 },
    });
    await t.app.inject({
      method: "DELETE",
      url: `/api/v1/admin/prazos-configurados/${id}`,
      headers,
    });

    expect(t.cenario.fila.jobs).toHaveLength(4);
    expect(
      t.cenario.fila.jobs.every(
        (j) => j.nome === "recalcular-prazos-configurados" && j.dados.empresaId === t.empresaA.id,
      ),
    ).toBe(true);
    expect(t.banco.auditoria.map((a) => [a.entidade, a.acao])).toEqual([
      ["prazo_configurado", "criar"],
      ["prazo_configurado", "alterar"],
      ["prazo_configurado", "alterar"],
      ["prazo_configurado", "excluir"],
    ]);
  });

  it("regra de outra empresa: 404 e nada enfileirado", async () => {
    t.banco.adm.prazos.push({
      id: crypto.randomUUID(),
      empresaId: t.empresaB.id,
      tipo: "unidade",
      unidadeCodigo: "CAP",
      unidadeDestinoCodigo: null,
      parceiroCnpj: null,
      parceiroNome: null,
      prazoHoras: 24,
      prazoDias: null,
      ativo: true,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    });
    const id = t.banco.adm.prazos[0]?.id ?? "";
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({
      method: "DELETE",
      url: `/api/v1/admin/prazos-configurados/${id}`,
      headers,
    });
    expect(r.json()).toEqual({
      erro: { codigo: "NAO_ENCONTRADO", mensagem: "Regra não encontrada nesta empresa." },
    });
    expect(t.banco.adm.prazos).toHaveLength(1);
    expect(t.cenario.fila.jobs).toHaveLength(0);
  });

  it("lista regras e opções de unidade e parceiro só da empresa", async () => {
    t.banco.adm.ctes.push(
      {
        empresaId: t.empresaA.id,
        filial: "CAP",
        unidadeCidade: "Campinas",
        parceiroCnpj: "1",
        parceiroNome: "Parceiro A",
      },
      {
        empresaId: t.empresaB.id,
        filial: "RIO",
        unidadeCidade: "Rio",
        parceiroCnpj: "2",
        parceiroNome: "Parceiro B",
      },
    );
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({ url: "/api/v1/admin/prazos-configurados", headers });
    expect(r.json()).toEqual({
      regras: [],
      unidades: [{ codigo: "CAP", cidade: "Campinas" }],
      parceiros: [{ cnpj: "1", nome: "Parceiro A" }],
    });
  });
});
