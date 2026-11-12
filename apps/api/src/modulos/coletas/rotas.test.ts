import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";

const AMOSTRA = readFileSync(
  join(__dirname, "../../dominio/coletas/__fixtures__/relatorio-050-amostra.txt"),
  "latin1",
);

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "coletas");
  cenario.banco.definirCargo(empresaId, "admin", { rotulo: "Admin", telas: ["coletas"] });
  cenario.banco.definirCargo(empresaId, "operador", { rotulo: "Op", permissoes: ["coletas.ver"] });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const importar = async (headers: { authorization: string }, conteudo = AMOSTRA) =>
  app.inject({
    method: "POST",
    url: "/api/v1/coletas/importacoes-050",
    headers,
    payload: { conteudo, arquivoOrigem: "050.txt" },
  });

describe("importação do 050", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/coletas/importacoes-050",
      payload: { conteudo: AMOSTRA, arquivoOrigem: "050.txt" },
    });
    expect(r.statusCode).toBe(401);
  });

  it("403 para quem só tem Ver em Coletas", async () => {
    expect((await importar(await comoPapel("operador"))).statusCode).toBe(403);
  });

  it("422 com arquivo que não é o 050, com a mensagem para o operador", async () => {
    const r = await importar(await comoPapel("admin"), "Serie;Numero\n1;2");
    expect(r.statusCode).toBe(422);
    expect(r.json<{ erro: { mensagem: string } }>().erro.mensagem).toMatch(/não é o relatório 050/);
  });

  it("grava, e o painel/lista/detalhe leem; reimportar o mesmo 050 regrava", async () => {
    const headers = await comoPapel("admin");
    const r = await importar(headers);
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      emitidoEm: "2026-11-03T15:01:00.000Z",
      lidas: 4,
      gravadas: 4,
      ignoradas: 0,
      unidades: ["ARA", "CAP"],
      resumoSsw: { quantidade: 4 },
    });
    expect((await importar(headers)).json()).toMatchObject({ gravadas: 4 });

    const filtro = { inicio: "2026-10-01", fim: "2026-10-31" };
    const painel = await app.inject({
      method: "POST",
      url: "/api/v1/coletas/painel",
      headers,
      payload: filtro,
    });
    expect(painel.json()).toMatchObject({
      totais: { total: 4, canceladas: 1, reversas: 1 },
      posicaoEm: "2026-11-03T15:01:00.000Z",
      opcoes: { unidades: ["ARA", "CAP"] },
    });
    const lista = await app.inject({
      method: "POST",
      url: "/api/v1/coletas/lista",
      headers,
      payload: { ...filtro, status: "canceladas" },
    });
    expect(lista.json()).toMatchObject({ total: 1, linhas: [{ unidade: "ARA", numero: 56205 }] });
    const exportada = await app.inject({
      method: "POST",
      url: "/api/v1/coletas/lista/exportacao",
      headers,
      payload: filtro,
    });
    expect(exportada.json<{ linhas: unknown[] }>().linhas).toHaveLength(4);
    const detalhe = await app.inject({ url: "/api/v1/coletas/ARA/56168", headers });
    expect(detalhe.statusCode).toBe(200);
    expect(detalhe.json<{ historico: unknown[] }>().historico.length).toBeGreaterThan(0);
    const inexistente = await app.inject({ url: "/api/v1/coletas/ARA/1", headers });
    expect(inexistente.statusCode).toBe(404);
  });
});
