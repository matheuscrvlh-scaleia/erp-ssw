import { randomUUID } from "node:crypto";

import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

function entregue(id: string, dia: string, extra: { escaneado?: boolean; tem88?: boolean } = {}) {
  return {
    id,
    empresaId,
    unidade: "RIO",
    dia,
    dataEntrega: new Date(`${dia}T15:00:00Z`),
    criadoEm: new Date("2026-11-01T00:00:00Z"),
    tipoDocumento455: "NORMAL",
    tipoDocumento: null,
    comprovanteEscaneado: extra.escaneado ?? null,
    tem88: extra.tem88 ?? false,
    numero: id.replace(/\D/g, "") || "1",
    sigla: "CAS",
    numeroNf: null,
    dataEmissao: "2026-11-01",
    setor: null,
    pagadorNome: "ACME",
    remetente: null,
    destinatario: null,
    cidadeDestino: null,
  };
}

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "comprovantes");
  cenario.banco.definirCargo(empresaId, "operador", { rotulo: "Op", telas: ["comprovantes"] });
  const dados = cenario.banco.ocorrencias;
  dados.arquivos930.push({ empresaId, nome: "930_ocorrencias_2026-11-04_0730.csv" });
  dados.entregues.push(
    entregue(randomUUID(), "2026-11-04", { tem88: true }),
    entregue(randomUUID(), "2026-11-04", { escaneado: true }),
    entregue(randomUUID(), "2026-11-04"),
    entregue(randomUUID(), "2026-11-03"),
  );
});
afterEach(() => app.close());

async function operador() {
  const usuario = cenario.banco.criarUsuario({ email: "op@fr.com.br" });
  cenario.banco.vincular(usuario.id, empresaId, { papel: "operador" });
  return entrarComo(cenario, usuario.id, empresaId);
}

const PERIODO = { inicio: "2026-11-01", fim: "2026-11-05" };

describe("Comprovantes", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/comprovantes/painel",
      payload: PERIODO,
    });
    expect(r.statusCode).toBe(401);
  });

  it("403 com o módulo desligado", async () => {
    cenario.banco.liberacoes = [];
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/comprovantes/painel",
      headers: await operador(),
      payload: PERIODO,
    });
    expect(r.statusCode).toBe(403);
  });

  it("422 com status desconhecido", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/comprovantes/lista",
      headers: await operador(),
      payload: { ...PERIODO, status: "todas" },
    });
    expect(r.statusCode).toBe(422);
  });

  it("painel com cobertura pelo 930 e lista dos pendentes", async () => {
    const headers = await operador();
    const painel = await app.inject({
      method: "POST",
      url: "/api/v1/comprovantes/painel",
      headers,
      payload: PERIODO,
    });
    expect(painel.json()).toMatchObject({
      totais: { entregues: 4, digitalizados: 2, pendentes: 1, pct: 0.6667 },
    });
    const lista = await app.inject({
      method: "POST",
      url: "/api/v1/comprovantes/lista",
      headers,
      payload: { ...PERIODO, status: "pendentes" },
    });
    expect(lista.json()).toMatchObject({
      total: 1,
      linhas: [{ digitalizado: false, tipoDocumento: "NORMAL", siglaCtrc: "CAS" }],
    });
  });

  it("página depois da última traz o total; exportação traz a lista inteira na ordem", async () => {
    const headers = await operador();
    const depois = await app.inject({
      method: "POST",
      url: "/api/v1/comprovantes/lista",
      headers,
      payload: { ...PERIODO, pagina: 3, tamanho: 2 },
    });
    expect(depois.json()).toEqual({ total: 4, linhas: [] });
    const exportada = await app.inject({
      method: "POST",
      url: "/api/v1/comprovantes/lista/exportacao",
      headers,
      payload: { ...PERIODO, status: "digitalizados" },
    });
    const linhas = exportada.json<{ linhas: { dataEntrega: string; digitalizado: boolean }[] }>()
      .linhas;
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.digitalizado)).toBe(true);
  });
});
