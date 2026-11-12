import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "performance");
  cenario.banco.definirCargo(empresaId, "operador", { rotulo: "Operador", telas: ["performance"] });
  cenario.banco.definirCargo(empresaId, "ranking", { rotulo: "Ranking", telas: ["ranking"] });
  cenario.banco.definirCargo(empresaId, "rh", { rotulo: "RH", telas: ["calendario"] });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const FILTRO = { inicio: "2026-11-01", fim: "2026-11-10" };

describe("POST /api/v1/performance/resumo", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({ method: "POST", url: "/api/v1/performance/resumo", body: FILTRO });
    expect(r.statusCode).toBe(401);
  });

  it("403 sem a tela e com o módulo desligado", async () => {
    const semTela = await app.inject({
      method: "POST",
      url: "/api/v1/performance/resumo",
      body: FILTRO,
      headers: await comoPapel("rh"),
    });
    expect(semTela.statusCode).toBe(403);
    expect(semTela.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });

    cenario.banco.liberacoes = [];
    const semModulo = await app.inject({
      method: "POST",
      url: "/api/v1/performance/resumo",
      body: FILTRO,
      headers: await comoPapel("operador"),
    });
    expect(semModulo.json()).toMatchObject({ erro: { codigo: "MODULO_NAO_LIBERADO" } });
  });

  it("422 com data inválida", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/performance/resumo",
      body: { inicio: "01/11/2026", fim: "2026-11-10" },
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ erro: { codigo: "ENTRADA_INVALIDA" } });
  });

  it("200 com a empresa da sessão e o filtro normalizado", async () => {
    const empresas: string[] = [];
    cenario.banco.performance.filiaisProprias = (id) => {
      empresas.push(id);
      return Promise.resolve(["ARA"]);
    };
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/performance/resumo",
      body: FILTRO,
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(200);
    expect(empresas).toEqual([empresaId]);
    expect(r.json()).toMatchObject({
      periodo: { inicio: "2026-11-01", fim: "2026-11-10", dias: 10 },
      totais: { totalCtrcs: 0 },
      porUnidade: [],
    });
  });
});

describe("série e configuração servem também ao Ranking", () => {
  it("quem só tem o Ranking lê a série; não lê o resumo", async () => {
    cenario.banco.liberacoes = [];
    cenario.banco.liberarModulo(empresaId, "ranking");
    const headers = await comoPapel("ranking");
    const serie = await app.inject({
      method: "POST",
      url: "/api/v1/performance/serie",
      body: { ...FILTRO, granularidade: "mes" },
      headers,
    });
    expect(serie.statusCode).toBe(200);
    const configuracao = await app.inject({ url: "/api/v1/performance/configuracao", headers });
    expect(configuracao.json()).toEqual({
      slaMetaPct: 95,
      slaAlertaAmareloPct: 90,
      taxaRetornoMetaPct: 3,
      otifVisivel: false,
    });
    const resumo = await app.inject({
      method: "POST",
      url: "/api/v1/performance/resumo",
      body: FILTRO,
      headers,
    });
    expect(resumo.statusCode).toBe(403);
  });
});

describe("demais leituras da tela", () => {
  it.each([
    ["pontualidade", FILTRO],
    ["tde-aguardando", FILTRO],
    ["otif", FILTRO],
    ["previstos", { ...FILTRO, ignorarPeriodo: true }],
    ["alertas", FILTRO],
    ["codigos-disponiveis", FILTRO],
    ["tipos-documento", FILTRO],
    ["relatorio", FILTRO],
    ["exportacao", FILTRO],
  ])("200 em %s", async (rota, body) => {
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/performance/${rota}`,
      body,
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(200);
  });
});
