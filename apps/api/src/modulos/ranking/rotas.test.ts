import { randomUUID } from "node:crypto";

import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import { hashDoToken } from "./casos-de-uso";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "ranking");
  const telas = ["ranking", "admin_equipes", "admin_bonificacao"];
  for (const papel of ["admin", "gestor", "operador"]) {
    cenario.banco.definirCargo(empresaId, papel, { rotulo: papel, telas });
  }
  cenario.banco.definirCargo(empresaId, "rh", { rotulo: "RH", telas: ["performance"] });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}-${randomUUID()}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

function novaEquipe(dados: { nome: string; ativo?: boolean; empresa?: string }) {
  const id = randomUUID();
  cenario.banco.ranking.equipes.push({
    id,
    empresaId: dados.empresa ?? empresaId,
    nome: dados.nome,
    unidadeId: null,
    ativo: dados.ativo ?? true,
    tokenPublicoHash: null,
    tokenPublicoRevogado: false,
  });
  return id;
}

const OPERACIONAL = { grupo: "pagador", inicio: "2026-11-01", fim: "2026-11-10" };

describe("POST /api/v1/ranking/operacional", () => {
  it("401 sem sessão, 403 sem a tela, 403 com o módulo desligado, 422 com data inválida", async () => {
    const url = "/api/v1/ranking/operacional";
    expect((await app.inject({ method: "POST", url, payload: OPERACIONAL })).statusCode).toBe(401);
    const semTela = await app.inject({
      method: "POST",
      url,
      payload: OPERACIONAL,
      headers: await comoPapel("rh"),
    });
    expect(semTela.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });
    const headers = await comoPapel("operador");
    const invalido = await app.inject({
      method: "POST",
      url,
      payload: { ...OPERACIONAL, inicio: "10/11/2026" },
      headers,
    });
    expect(invalido.statusCode).toBe(422);
    cenario.banco.liberacoes = [];
    const semModulo = await app.inject({ method: "POST", url, payload: OPERACIONAL, headers });
    expect(semModulo.json()).toMatchObject({ erro: { codigo: "MODULO_NAO_LIBERADO" } });
  });

  it("agrega os baldes e manda ao banco só filiais próprias, CNPJ em dígitos e tipos em maiúsculas", async () => {
    cenario.banco.ranking.filiaisProprias.set(empresaId, ["CAP", "ARA"]);
    cenario.banco.ranking.baldesRanking = [
      {
        chave: "12345678000190",
        temDataEntrega: true,
        codigoEfetivo: 1,
        noPrazo: true,
        responsabilidadeCliente: null,
        prevista: "no_prazo",
        quantidade: 4,
        pesoGramas: 1500,
        volumes: 3,
        freteCentavos: 12345,
      },
    ];
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ranking/operacional",
      payload: {
        ...OPERACIONAL,
        filiais: ["cap", "XYZ"],
        pagadores: ["12.345.678/0001-90"],
        tipos: [" normal ", ""],
        destino: "  ",
      },
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([
      expect.objectContaining({ chave: "12345678000190", totalCtes: 4, slaPct: 1, frete: 123.45 }),
    ]);
    expect(cenario.banco.ranking.filtrosRecebidos[0]).toMatchObject({
      filiais: ["CAP"],
      pagadores: ["12345678000190"],
      tipos: ["NORMAL"],
      destino: null,
      baseData: "emissao",
    });
  });
});

describe("equipes e membros", () => {
  it("operador lê mas não grava (só gestão)", async () => {
    const headers = await comoPapel("operador");
    const lista = await app.inject({ url: "/api/v1/ranking/equipes", headers });
    expect(lista.statusCode).toBe(200);
    const criar = await app.inject({
      method: "POST",
      url: "/api/v1/ranking/equipes",
      payload: { nome: "Equipe A" },
      headers,
    });
    expect(criar.statusCode).toBe(403);
  });

  it("gestor cria equipe, inclui motorista e ajudantes nas posições livres e audita", async () => {
    const headers = await comoPapel("gestor");
    const criada = await app.inject({
      method: "POST",
      url: "/api/v1/ranking/equipes",
      payload: { nome: "Equipe Cabo Frio A" },
      headers,
    });
    const { id } = criada.json<{ id: string }>();
    const incluir = (payload: object) =>
      app.inject({
        method: "POST",
        url: `/api/v1/ranking/equipes/${id}/membros`,
        payload,
        headers,
      });
    await incluir({ nome: "Zé", papel: "motorista" });
    await incluir({ nome: "Bia", papel: "ajudante", posicao: 2 });
    await incluir({ nome: "Ana", papel: "ajudante" });
    const ocupada = await incluir({ nome: "Caio", papel: "ajudante", posicao: 2 });
    expect(ocupada.statusCode).toBe(409);
    expect(ocupada.json()).toMatchObject({
      erro: { mensagem: "Ajudante 2 já está ocupado nesta equipe." },
    });

    const lista = await app.inject({ url: "/api/v1/ranking/equipes", headers });
    expect(lista.json<{ membros: { nome: string; posicao: number | null }[] }>().membros).toEqual([
      expect.objectContaining({ nome: "Zé", posicao: null }),
      expect.objectContaining({ nome: "Ana", posicao: 1 }),
      expect.objectContaining({ nome: "Bia", posicao: 2 }),
    ]);
    expect(cenario.banco.auditoria.map((a) => a.acao)).toEqual([
      "criar",
      "incluir_membro",
      "incluir_membro",
      "incluir_membro",
    ]);
  });

  it("remover membro grava a saída no dia de Brasília (23h em SP = mesmo dia)", async () => {
    const equipeId = novaEquipe({ nome: "A" });
    const membroId = randomUUID();
    cenario.banco.ranking.membros.push({
      id: membroId,
      empresaId,
      equipeId,
      nome: "Zé",
      papel: "motorista",
      cpf: null,
      posicao: null,
      dataSaida: null,
    });
    cenario.relogio.atual = new Date("2026-11-11T02:00:00Z");
    const r = await app.inject({
      method: "DELETE",
      url: `/api/v1/ranking/membros/${membroId}`,
      headers: await comoPapel("gestor"),
    });
    expect(r.statusCode).toBe(200);
    expect(cenario.banco.ranking.membros[0]?.dataSaida).toBe("2026-11-10");
  });

  it("equipe de outra empresa não é encontrada", async () => {
    const outra = novaEquipe({ nome: "Outra", empresa: randomUUID() });
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/ranking/equipes/${outra}/link`,
      headers: await comoPapel("admin"),
    });
    expect(r.statusCode).toBe(404);
  });

  it("atribuição grava de verdade e conta só os CT-e da empresa", async () => {
    const equipeId = novaEquipe({ nome: "A" });
    const meu = randomUUID();
    const deOutra = randomUUID();
    const base = { sigla: "CAP", dataEmissao: "2026-11-03", unidadeId: null, foraUniverso: false };
    cenario.banco.ranking.ctes.push(
      { id: meu, empresaId, numero: "1", equipeId: null, ...base },
      { id: deOutra, empresaId: randomUUID(), numero: "2", equipeId: null, ...base },
    );
    const headers = await comoPapel("gestor");
    const lista = await app.inject({
      url: "/api/v1/ranking/atribuicao?inicio=2026-11-01&fim=2026-11-30",
      headers,
    });
    expect(lista.json<{ ctes: { id: string }[] }>().ctes.map((c) => c.id)).toEqual([meu]);
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/ranking/atribuicao",
      payload: { cteIds: [meu, deOutra], equipeId },
      headers,
    });
    expect(r.json()).toEqual({ quantidade: 1 });
    expect(cenario.banco.ranking.ctes.map((c) => c.equipeId)).toEqual([equipeId, null]);
  });
});

describe("link público do ranking", () => {
  function regraVigente() {
    cenario.banco.ranking.regras.push({
      id: randomUUID(),
      empresaId,
      nome: "Regra",
      descricao: null,
      vigenciaInicio: "2026-01-01",
      vigenciaFim: null,
      ativo: true,
      criterios: [
        { id: randomUUID(), criterio: "entregas_prazo", parametros: { peso: 2 }, ordem: 0 },
      ],
    });
  }

  it("gerar link devolve o token uma vez e o banco guarda só o hash", async () => {
    const equipeId = novaEquipe({ nome: "A" });
    const r = await app.inject({
      method: "POST",
      url: `/api/v1/ranking/equipes/${equipeId}/link`,
      headers: await comoPapel("admin"),
    });
    const { token } = r.json<{ token: string }>();
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    const equipe = cenario.banco.ranking.equipes[0];
    expect(equipe?.tokenPublicoHash).toBe(hashDoToken(token));
    expect(equipe?.tokenPublicoHash).not.toBe(token);
  });

  it("abre sem login, calcula a posição entre as equipes ativas e o top 3", async () => {
    regraVigente();
    const a = novaEquipe({ nome: "A" });
    const b = novaEquipe({ nome: "B" });
    novaEquipe({ nome: "Inativa", ativo: false });
    cenario.banco.ranking.totais.set(a, { totalEntregas: 10, entregasNoPrazo: 5, penalizantes: 0 });
    cenario.banco.ranking.totais.set(b, { totalEntregas: 10, entregasNoPrazo: 9, penalizantes: 1 });
    const token = "a".repeat(48);
    const equipe = cenario.banco.ranking.equipes.find((e) => e.id === a);
    if (equipe) equipe.tokenPublicoHash = hashDoToken(token);

    const r = await app.inject({
      url: `/api/public/ranking/${token}?inicio=2026-11-01&fim=2026-11-30`,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      equipe: { id: a, nome: "A" },
      posicao: 2,
      totalEquipes: 2,
      top3: [
        { posicao: 1, nome: "B" },
        { posicao: 2, nome: "A" },
      ],
      calculo: { valorCalculado: 10, entregasNoPrazo: 5 },
    });
    expect(cenario.banco.contextos[0]).toMatchObject({
      empresaId: null,
      tokenPublicoHash: hashDoToken(token),
    });
  });

  it("token desconhecido ou revogado = link inválido; módulo desligado = indisponível", async () => {
    regraVigente();
    const a = novaEquipe({ nome: "A" });
    const token = "b".repeat(48);
    const url = `/api/public/ranking/${token}?inicio=2026-11-01&fim=2026-11-30`;
    expect((await app.inject({ url })).statusCode).toBe(404);

    const equipe = cenario.banco.ranking.equipes.find((e) => e.id === a);
    if (equipe) equipe.tokenPublicoHash = hashDoToken(token);
    cenario.banco.liberacoes = [];
    expect((await app.inject({ url })).json()).toMatchObject({
      erro: { mensagem: "Este ranking não está disponível no momento. Fale com a sua empresa." },
    });
  });
});

describe("regras", () => {
  it("gestor salva regra com critérios na ordem; operador não grava", async () => {
    const payload = {
      nome: "Q4",
      vigenciaInicio: "2026-10-01",
      criterios: [
        { criterio: "penalizante", parametros: { valor: 15 } },
        { criterio: "entregas_prazo", parametros: { peso: 2 } },
      ],
    };
    const negado = await app.inject({
      method: "POST",
      url: "/api/v1/ranking/regras",
      payload,
      headers: await comoPapel("operador"),
    });
    expect(negado.statusCode).toBe(403);
    const headers = await comoPapel("gestor");
    const salvo = await app.inject({
      method: "POST",
      url: "/api/v1/ranking/regras",
      payload,
      headers,
    });
    expect(salvo.statusCode).toBe(200);
    const regras = await app.inject({ url: "/api/v1/ranking/regras", headers });
    expect(
      regras.json<{ criterios: { criterio: string; ordem: number }[] }[]>()[0]?.criterios,
    ).toMatchObject([
      { criterio: "penalizante", ordem: 0 },
      { criterio: "entregas_prazo", ordem: 1 },
    ]);
  });
});
