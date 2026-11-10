import { randomUUID } from "node:crypto";

import { fato, ocorrencia, viagem } from "@erp/dominio/testes/romaneio";
import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import { type FatoDaLista } from "./casos-de-uso";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "romaneio");
  cenario.banco.definirCargo(empresaId, "operador", { rotulo: "Operador", telas: ["romaneio"] });
  cenario.banco.definirCargo(empresaId, "motorista", {
    rotulo: "Motorista",
    telas: ["romaneio", "romaneio_placa"],
  });
  cenario.banco.definirCargo(empresaId, "rh", { rotulo: "RH", telas: ["performance"] });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const FILTROS = { campo: "emissao", inicio: "2026-10-01", fim: "2026-10-31" };

function cte(extra: Partial<FatoDaLista> = {}): FatoDaLista {
  return {
    ...fato(),
    id: randomUUID(),
    numeroNf: 123,
    dataEmbarque: "2026-10-02",
    parceiroId: null,
    parceiroNome: "GRENDENE",
    unidadeId: null,
    filial: "SPO",
    remetente: "GRENDENE SA",
    ufDestino: "SP",
    setor: null,
    statusAtual: "EM ROTA",
    ...extra,
  };
}

describe("POST /api/v1/romaneio/lista", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/romaneio/lista",
      payload: { filtros: FILTROS },
    });
    expect(r.statusCode).toBe(401);
  });

  it("403 sem a tela e 403 com o módulo desligado", async () => {
    const semTela = await app.inject({
      method: "POST",
      url: "/api/v1/romaneio/lista",
      payload: { filtros: FILTROS },
      headers: await comoPapel("rh"),
    });
    expect(semTela.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });

    cenario.banco.liberacoes = [];
    const semModulo = await app.inject({
      method: "POST",
      url: "/api/v1/romaneio/lista",
      payload: { filtros: FILTROS },
      headers: await comoPapel("operador"),
    });
    expect(semModulo.statusCode).toBe(403);
    expect(semModulo.json()).toMatchObject({ erro: { codigo: "MODULO_NAO_LIBERADO" } });
  });

  it("422 com início depois do fim", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/romaneio/lista",
      payload: { filtros: { ...FILTROS, inicio: "2026-11-01" } },
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ erro: { codigo: "ENTRADA_INVALIDA" } });
  });

  it("200 com as linhas, os totais e o contexto da empresa (RLS)", async () => {
    const um = cte({ ocorrEfetivaCodigo: "85" });
    cenario.banco.romaneio.ctes = [um];
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/romaneio/lista",
      payload: { filtros: FILTROS },
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      total: 1,
      linhas: [{ id: um.id, numero: um.numero, ultimaOcorrencia: { codigo: 85 } }],
    });
    expect(cenario.banco.contextos.at(-1)).toMatchObject({ empresaId });
  });
});

describe("POST /api/v1/romaneio/performance/motoristas", () => {
  async function pedir(papel: string) {
    const um = cte({ ocorrencias: [ocorrencia(85, "2026-10-03T12:00:00Z")] });
    cenario.banco.romaneio.ctes = [um];
    cenario.banco.romaneio.viagens.set(um.id, [
      viagem({ romaneio: "R1", dataSaida: "2026-10-03" }),
    ]);
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/romaneio/performance/motoristas",
      payload: { filtros: FILTROS },
      headers: await comoPapel(papel),
    });
    expect(r.statusCode).toBe(200);
    return r.json<{ placas: string | null }[]>();
  }

  it("placa só com a permissão romaneio_placa", async () => {
    expect((await pedir("operador"))[0]?.placas).toBeNull();
    expect((await pedir("motorista"))[0]?.placas).toBe("KQK6I98");
  });
});

describe("GET /api/v1/romaneio/linha-do-tempo/:sigla/:numero", () => {
  it("422 com número inválido e 200 com os eventos", async () => {
    const headers = await comoPapel("operador");
    const invalido = await app.inject({
      url: "/api/v1/romaneio/linha-do-tempo/SPO/abc",
      headers,
    });
    expect(invalido.statusCode).toBe(422);

    cenario.banco.romaneio.ocorrencias = [
      {
        dataHora: new Date("2026-10-03T12:00:00Z"),
        codigo: 85,
        descricao: "SAIDA PARA ENTREGA",
        complemento: null,
      },
    ];
    const r = await app.inject({ url: "/api/v1/romaneio/linha-do-tempo/SPO/1001", headers });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject([{ codigo: "85", descricao: "SAIDA PARA ENTREGA" }]);
  });
});
