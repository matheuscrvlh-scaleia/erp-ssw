import { randomUUID } from "node:crypto";

import { JOB_PROPAGAR_CLASSIFICACAO } from "@erp/shared/jobs";
import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  type Cenario,
  construirAppDeTeste,
  criarCenario,
  entrarComo,
  FilaFalsa,
} from "../../testes/cenario";
import { type CodigoFalso } from "../../testes/falsos-ocorrencias";
import { LIMITE_DE_PROPAGACAO_IMEDIATA, salvarCodigo } from "./casos-de-uso";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

function codigo(c: Partial<CodigoFalso> & { codigo: number }): CodigoFalso {
  return {
    empresaId,
    descricao: `Código ${c.codigo}`,
    responsavel: "sistema",
    penaliza: false,
    letraResponsavel: "S",
    ativo: true,
    pendenteClassificacao: false,
    pendenciaAcompanhada: false,
    notas: null,
    tipoSsw: null,
    processoSsw: null,
    atualizadoEm: new Date("2026-11-01T00:00:00Z"),
    atualizadoPorNome: null,
    ...c,
  };
}

function ocorrencias(codigoDaOcorrencia: number, quantas: number, dia = "2026-11-05") {
  return Array.from({ length: quantas }, () => ({
    id: randomUUID(),
    empresaId,
    cteId: randomUUID(),
    codigo: codigoDaOcorrencia,
    descricao: null,
    dataHora: new Date(`${dia}T12:00:00Z`),
    quarentena: false,
    penaliza: false,
    responsavel: "outro",
  }));
}

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "ocorrencias");
  cenario.banco.definirCargo(empresaId, "admin", { rotulo: "Admin", telas: ["admin_codigos"] });
  cenario.banco.definirCargo(empresaId, "gestor", { rotulo: "Gestor", telas: ["admin_codigos"] });
  const dados = cenario.banco.ocorrencias;
  dados.codigos.push(
    codigo({ codigo: 13, descricao: "Devolução", responsavel: "FR", penaliza: true }),
    codigo({ codigo: 77, pendenteClassificacao: true, responsavel: "outro" }),
  );
  dados.ocorrencias.push(
    ...ocorrencias(13, 3),
    ...ocorrencias(77, 1),
    ...ocorrencias(13, 5, "2026-09-01"),
  );
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

describe("Admin › Códigos", () => {
  it("401 sem sessão", async () => {
    expect((await app.inject({ url: "/api/v1/admin/codigos" })).statusCode).toBe(401);
  });

  it("lista com frequência real de 30 dias e estatísticas", async () => {
    const r = await app.inject({
      url: "/api/v1/admin/codigos",
      headers: await comoPapel("gestor"),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      codigos: [
        { codigo: 13, frequencia30d: 3 },
        { codigo: 77, frequencia30d: 1 },
      ],
      estatisticas: { total: 2, classificados: 1, pendentes: 1, ocorrenciasEmPendentes: 1 },
    });
  });

  it("403 para escrever sem ser admin", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/codigos/lote",
      headers: await comoPapel("gestor"),
      payload: { codigos: [13], acao: "desativar" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("422 com descrição curta", async () => {
    const r = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/codigos/77",
      headers: await comoPapel("admin"),
      payload: { descricao: "ab", letra: "F", penaliza: true },
    });
    expect(r.statusCode).toBe(422);
  });

  it("classificar propaga para as ocorrências e audita só o que mudou", async () => {
    const headers = await comoPapel("admin");
    const r = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/codigos/77",
      headers,
      payload: { descricao: "Avaria", letra: "F", penaliza: true },
    });
    expect(r.json()).toEqual({ afetadas: 1 });
    const dados = cenario.banco.ocorrencias;
    expect(dados.ocorrencias.find((o) => o.codigo === 77)).toMatchObject({
      penaliza: true,
      responsavel: "FR",
    });
    expect(cenario.banco.auditoria.at(-1)).toMatchObject({
      entidade: "codigo_ocorrencia",
      entidadeId: "77",
      acao: "alterar",
      antes: { pendente_classificacao: true, penaliza: false, responsavel: "outro" },
    });

    const historico = await app.inject({ url: "/api/v1/admin/codigos/77/historico", headers });
    const acoes = historico
      .json<{ alteracoes: { acao: string }[] }>()
      .alteracoes.map((a) => a.acao);
    expect(acoes).toContain("classificou");
  });

  it("lote: desativar não propaga; penaliza_false propaga", async () => {
    const headers = await comoPapel("admin");
    const lote = (acao: string) =>
      app.inject({
        method: "POST",
        url: "/api/v1/admin/codigos/lote",
        headers,
        payload: { codigos: [13, 77], acao },
      });
    expect((await lote("desativar")).json()).toEqual({ alterados: 2 });
    expect((await lote("desativar")).json()).toEqual({ alterados: 0 });
    expect((await lote("penaliza_false")).json()).toEqual({ alterados: 1 });
    expect(
      cenario.banco.ocorrencias.ocorrencias
        .filter((o) => o.codigo === 13)
        .every((o) => !o.penaliza && o.responsavel === "FR"),
    ).toBe(true);
  });
});

describe("propagação grande vai para o worker", () => {
  it("acima do limite enfileira depois da transação, sem regravar na hora", async () => {
    cenario.banco.ocorrencias.ocorrencias.push(...ocorrencias(13, LIMITE_DE_PROPAGACAO_IMEDIATA));
    const fila = new FilaFalsa();
    const usuarioId = randomUUID();
    await salvarCodigo(
      (fn) => cenario.banco.executar({ empresaId, usuarioId, plataforma: false }, fn),
      { fila },
      { empresaId, usuarioId },
      { usuarioId, email: "a@fr.com.br", plataforma: false, ip: null, userAgent: null },
      13,
      { descricao: "Devolução", letra: "C", penaliza: true, ativo: true, notas: null },
      new Date(),
    );
    expect(fila.jobs).toEqual([
      { ...JOB_PROPAGAR_CLASSIFICACAO, dados: { empresaId, codigos: [13] } },
    ]);
    expect(cenario.banco.ocorrencias.ocorrencias.some((o) => o.responsavel === "cliente")).toBe(
      false,
    );
  });
});
