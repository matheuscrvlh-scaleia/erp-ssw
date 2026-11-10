import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import { type FiltroDeOpcoes } from "./casos-de-uso";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;
let headers: { authorization: string };

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  const usuario = cenario.banco.criarUsuario({ email: "op@fr.com.br" });
  cenario.banco.vincular(usuario.id, empresaId, { papel: "operador" });
  headers = await entrarComo(cenario, usuario.id, empresaId);
});
afterEach(() => app.close());

describe("filtros de CT-e", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({ url: "/api/v1/filtros-ctrc/tipos-documento" });
    expect(r.statusCode).toBe(401);
  });

  it("422 com campo de sugestão desconhecido", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/filtros-ctrc/sugestoes",
      body: { campo: "pagador", q: "a" },
      headers,
    });
    expect(r.statusCode).toBe(422);
  });

  it("unidades responsáveis: só as filiais próprias, em ordem, e o catálogo", async () => {
    let visto: FiltroDeOpcoes | null = null;
    cenario.banco.filtrosCtrc.filiaisProprias = () => Promise.resolve(["ARA", "CAP"]);
    cenario.banco.filtrosCtrc.siglasComCtrc = (_e, filtro) => {
      visto = filtro;
      return Promise.resolve(["CAP", "TERC", "ARA"]);
    };
    cenario.banco.filtrosCtrc.codigosDoCatalogo = () =>
      Promise.resolve([{ codigo: 1, descricao: "Entrega" }]);
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/filtros-ctrc/unidades-responsaveis",
      body: {
        inicio: "2026-11-01",
        fim: "2026-11-10",
        parceiros: ["12.345.678/0001-90"],
        remetente: "acme",
      },
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({
      siglas: ["ARA", "CAP"],
      codigos: [{ codigo: 1, descricao: "Entrega" }],
    });
    expect(visto).toMatchObject({ parceiros: ["12345678000190"], remetente: ["%acme%"] });
  });

  it("sugestões ignoram o filtro do próprio campo e, sem período, todos os outros", async () => {
    const filtros: FiltroDeOpcoes[] = [];
    cenario.banco.filtrosCtrc.sugestoes = (_e, _c, padrao, filtro) => {
      filtros.push(filtro);
      return Promise.resolve([padrao ?? ""]);
    };
    const comPeriodo = await app.inject({
      method: "POST",
      url: "/api/v1/filtros-ctrc/sugestoes",
      body: {
        campo: "remetente",
        q: " ac ",
        inicio: "2026-11-01",
        fim: "2026-11-10",
        remetente: "x",
        destino: "y",
      },
      headers,
    });
    expect(comPeriodo.json()).toEqual(["%ac%"]);
    expect(filtros[0]).toMatchObject({ remetente: null, destino: ["%y%"] });

    await app.inject({
      method: "POST",
      url: "/api/v1/filtros-ctrc/sugestoes",
      body: { campo: "cidade_destino", q: "", remetente: "x" },
      headers,
    });
    expect(filtros[1]).toMatchObject({ periodo: null, remetente: null });
  });

  it("pagadores: unidade por uuid vira sigla pelo apelido da cidade", async () => {
    let siglas: string[] | null = null;
    cenario.banco.filtrosCtrc.cidadesDasUnidades = () => Promise.resolve(["Araçatuba"]);
    cenario.banco.filtrosCtrc.apelidosDeFiliais = () =>
      Promise.resolve([
        { cidadeNormalizada: "ARACATUBA", filial: "ARA" },
        { cidadeNormalizada: "CAMPINAS", filial: "CAP" },
      ]);
    cenario.banco.filtrosCtrc.pagadores = (_e, filtro) => {
      siglas = filtro.siglas;
      return Promise.resolve([]);
    };
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/filtros-ctrc/pagadores",
      body: { unidades: ["tre", crypto.randomUUID()] },
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(siglas).toEqual(["TRE", "ARA"]);
  });
});
