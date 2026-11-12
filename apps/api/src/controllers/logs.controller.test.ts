import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resumoDaExecucao } from "../models/logs/logs.service";
import { cenarioDeAdmin } from "../testes/admin";

let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
beforeEach(async () => {
  t = await cenarioDeAdmin();
  const ator = {
    usuarioId: "x",
    email: "quem@fr.com.br",
    plataforma: false,
    ip: null,
    userAgent: null,
  };
  const evento = {
    acao: "alterar",
    entidade: "cargo",
    entidadeId: "x",
    resumo: "r",
    antes: null,
    depois: null,
  };
  t.banco.auditoria.push(
    { ...evento, empresaId: t.empresaA.id, ator },
    { ...evento, empresaId: t.empresaB.id, ator, resumo: "da outra" },
    { ...evento, empresaId: null, ator, resumo: "da plataforma" },
  );
});
afterEach(() => t.app.close());

describe("Admin › Logs", () => {
  it("401, 403 para operador", async () => {
    expect((await t.app.inject({ url: "/api/v1/admin/logs/alteracoes" })).statusCode).toBe(401);
    const operador = await t.comoPapel("operador");
    const r = await t.app.inject({
      url: "/api/v1/admin/logs/alteracoes",
      headers: operador.headers,
    });
    expect(r.statusCode).toBe(403);
  });

  it("admin vê só os registros da empresa ativa", async () => {
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({ url: "/api/v1/admin/logs/alteracoes", headers });
    expect(r.statusCode).toBe(200);
    const linhas = r.json<{ linhas: { resumo: string; empresaId: string }[] }>().linhas;
    expect(linhas.map((l) => l.resumo)).toEqual(["r"]);
  });

  it("422 com data inválida", async () => {
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({ url: "/api/v1/admin/logs/alteracoes?de=10/11/2026", headers });
    expect(r.statusCode).toBe(422);
  });

  it("integrações: execuções da empresa ativa, juntas e com resumo", async () => {
    t.banco.adm.execucoes.push(
      {
        empresaId: t.empresaA.id,
        origem: "bi2",
        execucao: {
          id: "1",
          quando: new Date("2026-11-10T10:00:00Z"),
          status: "ok",
          erro: null,
          dados: {
            codigo: "0017",
            dataAlvo: "2026-11-09",
            modo: "manual",
            linhas: 3,
            criados: 1,
            atualizados: 2,
          },
        },
      },
      {
        empresaId: t.empresaB.id,
        origem: "bi2",
        execucao: { id: "2", quando: new Date(), status: "ok", erro: null, dados: {} },
      },
    );
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({ url: "/api/v1/admin/logs/integracoes", headers });
    expect(r.json()).toEqual({
      linhas: [
        {
          id: "bi2:1",
          origem: "bi2",
          quando: "2026-11-10T10:00:00.000Z",
          status: "ok",
          resumo: "Relatório 0017 de 2026-11-09 (manual): 3 linha(s), 1 criado(s), 2 atualizado(s)",
          erro: null,
        },
      ],
    });
  });
});

describe("Plataforma › Logs", () => {
  it("só a Plataforma: admin de empresa toma 403", async () => {
    const { headers } = await t.comoPapel("admin");
    const r = await t.app.inject({ url: "/api/v1/plataforma/logs/alteracoes", headers });
    expect(r.statusCode).toBe(403);
  });

  it("todas, uma empresa ou só as da Plataforma", async () => {
    const { headers } = await t.comoPlataforma();
    const todas = await t.app.inject({ url: "/api/v1/plataforma/logs/alteracoes", headers });
    expect(todas.json<{ linhas: unknown[] }>().linhas).toHaveLength(3);
    const daB = await t.app.inject({
      url: `/api/v1/plataforma/logs/alteracoes?empresa=${t.empresaB.id}`,
      headers,
    });
    expect(daB.json()).toMatchObject({
      linhas: [{ resumo: "da outra", empresaNome: "Outra Transportadora" }],
    });
    const plataforma = await t.app.inject({
      url: "/api/v1/plataforma/logs/alteracoes?empresa=plataforma",
      headers,
    });
    expect(plataforma.json()).toMatchObject({ linhas: [{ resumo: "da plataforma" }] });
    expect(t.banco.contextos.at(-1)).toMatchObject({ plataforma: true, empresaId: null });
  });
});

describe("resumoDaExecucao", () => {
  it("monta o texto de cada origem como a tela de hoje", () => {
    expect(
      resumoDaExecucao("sftp_xml", {
        arquivosProcessados: 2,
        ctesProcessados: 10,
        arquivosComErro: 1,
        disparadoPor: "manual",
      }),
    ).toBe("2 arquivo(s), 10 CT-e, 1 com erro · manual");
    expect(
      resumoDaExecucao("relatorio_ssw", { relatorio: null, nomeArquivo: "a.csv", linhas: 0 }),
    ).toBe("? · a.csv");
    expect(
      resumoDaExecucao("aplicacao_ssw", {
        inseridos: 1,
        atualizados: 2,
        ocorrencias: 3,
        ignorados: 4,
        simulacao: true,
      }),
    ).toBe("1 inserido(s), 2 atualizado(s), 3 ocorrência(s), 4 ignorado(s) · simulação");
  });
});
