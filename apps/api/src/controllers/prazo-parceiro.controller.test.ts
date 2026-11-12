import { randomUUID } from "node:crypto";

import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type FatoDoPrazo } from "../models/prazo-parceiro/prazo-parceiro.service";
import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "prazo_parceiro");
  cenario.banco.definirCargo(empresaId, "operador", {
    rotulo: "Operador",
    telas: ["prazo_parceiro"],
  });
  cenario.banco.definirCargo(empresaId, "rh", { rotulo: "RH", telas: ["performance"] });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const FILTROS = { inicio: "2026-11-01", fim: "2026-11-10" };
const CNPJ = "11222333000144";

function cte(extra: Partial<FatoDoPrazo> = {}): FatoDoPrazo {
  return {
    id: randomUUID(),
    sigla: "SPO",
    numero: "1001",
    dataEmissao: "2026-11-05",
    dataEmbarque: "2026-11-05",
    dataPrevista: "2026-11-08",
    prazoPadraoData: "2026-11-07",
    prazoOrigem: "proprio",
    parceiroId: null,
    parceiroCnpj: null,
    parceiroNome: null,
    penalizado: false,
    statusAtual: null,
    setor: null,
    unidadeNome: "SPO",
    cidadeDestino: "CAMPINAS",
    ufDestino: "SP",
    ...extra,
  };
}

describe("POST /api/v1/prazo-parceiro/visao-geral", () => {
  it("401, 403 sem a tela, 422 com período invertido", async () => {
    const url = "/api/v1/prazo-parceiro/visao-geral";
    expect((await app.inject({ method: "POST", url, payload: FILTROS })).statusCode).toBe(401);
    const semTela = await app.inject({
      method: "POST",
      url,
      payload: FILTROS,
      headers: await comoPapel("rh"),
    });
    expect(semTela.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });
    const invertido = await app.inject({
      method: "POST",
      url,
      payload: { inicio: "2026-11-10", fim: "2026-11-01" },
      headers: await comoPapel("operador"),
    });
    expect(invertido.statusCode).toBe(422);
  });

  it("exemplo da spec e período anterior do mesmo tamanho; SLA da configuração", async () => {
    const prazo = cenario.banco.prazoParceiro;
    prazo.configuracoes.set("sla_meta_pct", "97");
    prazo.ctes = [
      ...Array.from({ length: 80 }, (_, i) => cte({ penalizado: i < 4 })),
      ...Array.from({ length: 20 }, (_, i) => cte({ prazoOrigem: "parceiro", penalizado: i < 6 })),
    ];
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/prazo-parceiro/visao-geral",
      payload: FILTROS,
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(200);
    const corpo = r.json<{ totais: Record<string, number>; sla: object }>();
    expect(corpo.totais.performanceTotal).toBeCloseTo(0.9);
    expect(corpo.totais.performancePropria).toBeCloseTo(0.95);
    expect(corpo.sla).toEqual({ meta: 0.97, alerta: 0.9 });
    expect(prazo.consultas.map((c) => c.periodo)).toEqual([
      FILTROS,
      { inicio: "2026-10-22", fim: "2026-10-31" },
    ]);
  });
});

describe("POST /api/v1/prazo-parceiro/lista", () => {
  it("nascidos por padrão, embarque mais recente primeiro, total da consulta inteira", async () => {
    const velho = cte({ dataEmbarque: "2026-11-02", dataPrevista: "2026-11-06" });
    const novo = cte({ dataEmbarque: "2026-11-09", dataPrevista: "2026-11-06" });
    cenario.banco.prazoParceiro.ctes = [velho, novo, cte()];
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/prazo-parceiro/lista",
      payload: { filtros: FILTROS, tamanho: 50 },
      headers: await comoPapel("operador"),
    });
    expect(r.json()).toMatchObject({
      total: 2,
      linhas: [{ id: novo.id, diasAbaixoDoPadrao: 1, nasceuAtrasado: true }, { id: velho.id }],
    });
  });
});

describe("GET /api/v1/prazo-parceiro/opcoes", () => {
  it("unidades, parceiros ativos por nome e tipos de documento do período", async () => {
    const banco = cenario.banco.prazoParceiro;
    banco.unidades = [{ id: "00000000-0000-4000-8000-0000000000aa", nome: "SAO PAULO" }];
    banco.tipos = ["CTE", "__SEM_TIPO__"];
    const r = await app.inject({
      method: "GET",
      url: "/api/v1/prazo-parceiro/opcoes?inicio=2026-11-01&fim=2026-11-10",
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ tipos: ["CTE", "__SEM_TIPO__"], unidades: banco.unidades });
    const semPeriodo = await app.inject({
      method: "GET",
      url: "/api/v1/prazo-parceiro/opcoes",
      headers: await comoPapel("operador"),
    });
    expect(semPeriodo.statusCode).toBe(422);
  });
});

describe("POST /api/v1/prazo-parceiro/parceiros/:id", () => {
  it("detalhe pelo CNPJ de parceiro sem cadastro (Q08) e 404 para cadastro inexistente", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.prazoParceiro.ctes = [
      cte({ parceiroCnpj: CNPJ, parceiroNome: "EXPEDIDOR", dataPrevista: "2026-11-06" }),
      cte({ parceiroCnpj: "99888777000166" }),
    ];
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/prazo-parceiro/parceiros/cnpj:${CNPJ}`,
      payload: FILTROS,
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      parceiro: { nome: "EXPEDIDOR", prazoAcordoHoras: null },
      resumo: { totalCtes: 1, nascidosAtrasados: 1 },
      histograma: [{ faixa: "1 dia", qtd: 1 }],
    });

    const inexistente = await app.inject({
      method: "POST",
      url: `/api/v1/prazo-parceiro/parceiros/${randomUUID()}`,
      payload: FILTROS,
      headers,
    });
    expect(inexistente.statusCode).toBe(404);
  });

  it("detalhe pelo cadastro traz os CT-e do CNPJ dele e o acordo em horas", async () => {
    const prazo = cenario.banco.prazoParceiro;
    const id = randomUUID();
    prazo.cadastros = [
      {
        id,
        nome: "PARCEIRO X",
        cnpj: "11.222.333/0001-44",
        usaSsw: true,
        criadoEm: new Date("2026-01-01"),
        prazoAcordoHoras: 72,
        ativo: true,
      },
    ];
    prazo.ctes = [cte({ parceiroId: id }), cte({ parceiroCnpj: CNPJ }), cte()];
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/prazo-parceiro/parceiros/${id}`,
      payload: FILTROS,
      headers: await comoPapel("operador"),
    });
    expect(r.json()).toMatchObject({
      parceiro: { nome: "PARCEIRO X", prazoAcordoHoras: 72 },
      resumo: { totalCtes: 2 },
    });
  });
});
