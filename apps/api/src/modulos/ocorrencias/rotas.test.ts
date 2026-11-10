import { randomUUID } from "node:crypto";

import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type CteFalso } from "../../testes/falsos-ocorrencias";
import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

function cte(numero: string, dataEmissao: string, extra: Partial<CteFalso> = {}): CteFalso {
  return {
    id: randomUUID(),
    empresaId,
    sigla: "CAS",
    numero,
    dataEmissao,
    dataPrevistaEntrega: "2026-11-06",
    dataEntregaRealizada: null,
    codigoEfetivo: null,
    noPrazo: null,
    pagadorNome: "ACME",
    pagadorCnpj: "11222333000144",
    filialEfetiva: "RIO",
    tipoDocumento455: "NORMAL",
    tipoDocumento: null,
    parceiroNome: null,
    numeroNf: 123,
    destinatario: "Cliente",
    cidadeDestino: "Rio de Janeiro",
    ufDestino: "RJ",
    peso: 10.5,
    volumes: 2,
    valorFrete: 99.9,
    setor: "264",
    ...extra,
  };
}

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "ocorrencias");
  cenario.banco.definirCargo(empresaId, "operador", { rotulo: "Operador", telas: ["ocorrencias"] });
  cenario.banco.definirCargo(empresaId, "rh", { rotulo: "RH", telas: ["performance"] });

  const dados = cenario.banco.ocorrencias;
  dados.codigos.push(
    ...[
      { codigo: 13, descricao: "Devolução", responsavel: "FR" as const, penaliza: true },
      { codigo: 15, descricao: "Reagendada", responsavel: "sistema" as const, penaliza: false },
      { codigo: 40, descricao: "Fora da tela", responsavel: "sistema" as const, penaliza: false },
    ].map((c) => ({
      ...c,
      empresaId,
      letraResponsavel: null,
      ativo: true,
      pendenteClassificacao: false,
      pendenciaAcompanhada: true,
      notas: null,
      tipoSsw: null,
      processoSsw: null,
      atualizadoEm: new Date(),
      atualizadoPorNome: null,
    })),
  );
  dados.configuracoes.push({ empresaId, chave: "ocorrencias_codigos_fora_da_tela", valor: "40" });
  const a = cte("9", "2026-11-02");
  const b = cte("10", "2026-11-03", { dataPrevistaEntrega: "2026-11-20" });
  dados.ctes.push(a, b);
  const oc = (cteId: string, codigo: number, dia: string, quarentena = false) => ({
    id: randomUUID(),
    empresaId,
    cteId,
    codigo,
    descricao: null,
    dataHora: new Date(`${dia}T12:00:00Z`),
    quarentena,
    penaliza: false,
    responsavel: "sistema",
  });
  dados.ocorrencias.push(
    oc(a.id, 13, "2026-11-03"),
    oc(a.id, 15, "2026-11-04"),
    oc(b.id, 13, "2026-11-04"),
    oc(b.id, 40, "2026-11-04"),
    oc(b.id, 15, "2026-11-01", true),
  );
  dados.conferentes.push({
    empresaId,
    sigla: "CAS",
    numero: "9",
    conferente: "JOAO",
    romaneio: "RIO 1-1",
  });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const PERIODO = { inicio: "2026-11-01", fim: "2026-11-05" };

describe("POST /api/v1/ocorrencias/painel", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/painel",
      payload: PERIODO,
    });
    expect(r.statusCode).toBe(401);
  });

  it("403 sem a tela", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/painel",
      headers: await comoPapel("rh"),
      payload: PERIODO,
    });
    expect(r.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });
  });

  it("403 com o módulo desligado", async () => {
    cenario.banco.liberacoes = [];
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/painel",
      headers: await comoPapel("operador"),
      payload: PERIODO,
    });
    expect(r.json()).toMatchObject({ erro: { codigo: "MODULO_NAO_LIBERADO" } });
  });

  it("422 com data inválida", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/painel",
      headers: await comoPapel("operador"),
      payload: { ...PERIODO, fim: "2026-02-30" },
    });
    expect(r.statusCode).toBe(422);
  });

  it("200: códigos da tela, sem quarentena, com o mês anterior e no contexto da empresa", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/painel",
      headers: await comoPapel("operador"),
      payload: PERIODO,
    });
    expect(r.statusCode).toBe(200);
    const painel = r.json<Record<string, unknown>>();
    expect(painel).toMatchObject({
      periodoAnterior: { inicio: "2026-10-01", fim: "2026-10-05" },
      codigosAcompanhados: 2,
      // 13+15 do CT-e 9 e 13 do CT-e 10 (o 40 está fora da tela; o 15 do 10 está em quarentena)
      metricas: { total: 3, ctrcs: 2, penalizantes: 1, naoPenalizantes: 1, pendentes: 0 },
    });
    expect(cenario.banco.contextos.at(-1)).toMatchObject({ empresaId });
  });
});

describe("lista, ver códigos e opções", () => {
  it("lista com conferente/romaneio, detalhes do CT-e e total", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/lista",
      headers: await comoPapel("operador"),
      payload: { ...PERIODO, ordem: "numero_ctrc", direcao: "asc", tamanho: 2 },
    });
    expect(r.statusCode).toBe(200);
    const { linhas, total } = r.json<{ linhas: Record<string, unknown>[]; total: number }>();
    expect(total).toBe(3);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({
      numeroCtrc: "9",
      conferente: "JOAO",
      romaneio: "RIO 1-1",
      numeroNf: 123,
      atrasoDias: 4,
      pagador: "ACME",
    });
  });

  it("422 com tamanho de página acima de 500", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/lista",
      headers: await comoPapel("operador"),
      payload: { ...PERIODO, tamanho: 501 },
    });
    expect(r.statusCode).toBe(422);
  });

  it("ver códigos do card penalizantes", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/codigos-do-card",
      headers: await comoPapel("operador"),
      payload: { ...PERIODO, card: "penalizantes" },
    });
    expect(r.json<{ codigos: { codigo: number }[] }>().codigos.map((c) => c.codigo)).toEqual([
      13, 15,
    ]);
  });

  it("opções trazem os códigos da tela e os conferentes", async () => {
    const headers = await comoPapel("operador");
    const opcoes = await app.inject({
      method: "POST",
      url: "/api/v1/ocorrencias/opcoes",
      headers,
      payload: PERIODO,
    });
    expect(opcoes.json()).toMatchObject({
      codigos: [
        { codigo: 13, descricao: "Devolução" },
        { codigo: 15, descricao: "Reagendada" },
      ],
    });
    const conferentes = await app.inject({ url: "/api/v1/ocorrencias/conferentes", headers });
    expect(conferentes.json()).toEqual({ conferentes: ["JOAO"] });
  });
});
