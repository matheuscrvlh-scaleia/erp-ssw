import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import { cidadeNormalizada } from "./casos-de-uso";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;
let headers: { authorization: string };

const UNIDADE = "6f1c2a3b-0000-4000-8000-000000000001";

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  const usuario = cenario.banco.criarUsuario({ email: "op@fr.com.br" });
  cenario.banco.vincular(usuario.id, empresaId, { papel: "operador" });
  headers = await entrarComo(cenario, usuario.id, empresaId);
  cenario.banco.ctrc.proprias = ["ARA", "CAP", "CAS"];
  cenario.banco.ctrc.codigos = [
    {
      codigo: 13,
      descricao: "PREJUDICADA",
      tipoSsw: null,
      penaliza: true,
      pendenciaAcompanhada: true,
    },
  ];
});
afterEach(() => app.close());

describe("filtros compartilhados", () => {
  it("401 sem sessão (basta sessão com empresa: as telas já têm guarda)", async () => {
    for (const url of [
      "/api/v1/filtros/filiais-proprias",
      "/api/v1/filtros/opcoes",
      "/api/v1/filtros/pagadores",
      "/api/v1/filtros/tipos-documento",
    ]) {
      expect((await app.inject({ url })).statusCode, url).toBe(401);
    }
  });

  it("filiais próprias e catálogo de códigos", async () => {
    expect((await app.inject({ url: "/api/v1/filtros/filiais-proprias", headers })).json()).toEqual(
      ["ARA", "CAP", "CAS"],
    );
    expect((await app.inject({ url: "/api/v1/filtros/codigos", headers })).json()).toEqual([
      { codigo: 13, descricao: "PREJUDICADA", penaliza: true },
    ]);
  });

  it("opções: só siglas próprias do período, mais as escolhidas, em ordem", async () => {
    cenario.banco.filtros.siglas = ["CAS", "XYZ", "ara"];
    const r = await app.inject({
      url: "/api/v1/filtros/opcoes?inicio=2026-11-01&fim=2026-11-10&filiais=cap&remetente=a|b",
      headers,
    });
    expect(r.json()).toMatchObject({ filiais: ["ARA", "CAP", "CAS"] });
    const [pedido] = cenario.banco.filtros.pedidos;
    expect(pedido?.argumentos[1]).toMatchObject({ remetente: ["%a%", "%b%"] });
  });

  it("opções: a consulta do período falhou → filiais de todos os CT-e", async () => {
    cenario.banco.filtros.falharNoPeriodo = true;
    cenario.banco.filtros.filiais = ["CAP", "OUTRA"];
    const r = await app.inject({
      url: "/api/v1/filtros/opcoes?inicio=2026-11-01&fim=2026-11-10",
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ filiais: ["CAP"] });
  });

  it("sugestões: o filtro do próprio campo não entra e o texto é literal", async () => {
    cenario.banco.filtros.valores = ["ACME"];
    const r = await app.inject({
      url: "/api/v1/filtros/sugestoes?campo=remetente&q=10%25&inicio=2026-11-01&fim=2026-11-10&remetente=x&destino=y",
      headers,
    });
    expect(r.json()).toEqual(["ACME"]);
    const [pedido] = cenario.banco.filtros.pedidos;
    expect(pedido?.argumentos.slice(1, 3)).toEqual(["remetente", "%10\\%%"]);
    expect(pedido?.argumentos[3]).toMatchObject({ remetente: null, destino: ["%y%"] });
  });

  it("422 para campo de sugestão desconhecido", async () => {
    const r = await app.inject({ url: "/api/v1/filtros/sugestoes?campo=senha", headers });
    expect(r.statusCode).toBe(422);
  });

  it("pagadores: unidade por id vira as siglas da cidade; nome cai no CNPJ", async () => {
    cenario.banco.filtros.cidades.set(UNIDADE, "São José");
    cenario.banco.filtros.apelidos.set(cidadeNormalizada("São José"), "CAS");
    cenario.banco.filtros.agrupados = [
      { cnpj: "12345678000190", cnpjGravado: null, nome: null, qtd: 3 },
      { cnpj: "11222333000144", cnpjGravado: "11.222.333/0001-44", nome: "ACME", qtd: 1 },
    ];
    const r = await app.inject({
      url: `/api/v1/filtros/pagadores?inicio=2026-11-01&fim=2026-11-10&unidades=${UNIDADE}&unidades=ara&campoData=saida`,
      headers,
    });
    expect(r.json()).toEqual([
      { id: "12345678000190", nome: "12.345.678/0001-90", cnpjFormatado: "12.345.678/0001-90" },
      { id: "11222333000144", nome: "ACME", cnpjFormatado: "11.222.333/0001-44" },
    ]);
    const [pedido] = cenario.banco.filtros.pedidos;
    expect(pedido?.argumentos[1]).toMatchObject({
      siglas: ["ARA", "CAS"],
      periodo: { campo: "saida", inicio: "2026-11-01", fim: "2026-11-10" },
      limite: 500,
    });
  });

  it("pagadores: filial que não é própria não consulta e devolve vazio (Q10)", async () => {
    const r = await app.inject({ url: "/api/v1/filtros/pagadores?filiais=XYZ", headers });
    expect(r.json()).toEqual([]);
    expect(cenario.banco.filtros.pedidos).toEqual([]);
  });

  it("tipos de documento: falha vira vazio; no período, falha vira nulo", async () => {
    cenario.banco.filtros.tiposDocumento = () => Promise.reject(new Error("fora"));
    cenario.banco.filtros.tiposDocumentoNoPeriodo = () => Promise.reject(new Error("fora"));
    expect((await app.inject({ url: "/api/v1/filtros/tipos-documento", headers })).json()).toEqual(
      [],
    );
    const r = await app.inject({
      url: "/api/v1/filtros/tipos-documento-periodo?inicio=2026-11-01&fim=2026-11-10&campoData=entrega",
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toBeNull();
  });

  it("422 sem a base de data do período", async () => {
    const r = await app.inject({
      url: "/api/v1/filtros/tipos-documento-periodo?inicio=2026-11-01&fim=2026-11-10",
      headers,
    });
    expect(r.statusCode).toBe(422);
  });
});
