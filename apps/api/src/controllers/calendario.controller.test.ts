import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  const empresa = cenario.banco.criarEmpresa();
  empresaId = empresa.id;
  cenario.banco.liberarModulo(empresaId, "historico");
  cenario.banco.definirCargo(empresaId, "admin", { rotulo: "Admin", telas: ["calendario"] });
  cenario.banco.definirCargo(empresaId, "operador", {
    rotulo: "Operador",
    permissoes: ["calendario.ver"],
  });
  cenario.banco.definirCargo(empresaId, "rh", { rotulo: "RH", telas: ["performance"] });
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const FERIADO = {
  data: "2026-08-15",
  tipo: "municipal",
  cidade: "Campinas",
  uf: "SP",
  descricao: "Padroeira",
};

describe("GET /api/v1/calendario", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({ url: "/api/v1/calendario?ano=2026" });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject({ erro: { codigo: "NAO_AUTENTICADO" } });
  });

  it("403 sem a tela e 403 com módulo desligado (mensagem para o operador)", async () => {
    const semTela = await app.inject({
      url: "/api/v1/calendario?ano=2026",
      headers: await comoPapel("rh"),
    });
    expect(semTela.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });

    cenario.banco.liberacoes = [];
    const semModulo = await app.inject({
      url: "/api/v1/calendario?ano=2026",
      headers: await comoPapel("operador"),
    });
    expect(semModulo.statusCode).toBe(403);
    expect(semModulo.json()).toEqual({
      erro: {
        codigo: "MODULO_NAO_LIBERADO",
        mensagem:
          "O módulo Histórico e calendário não está liberado para esta empresa. Fale com o suporte para liberar.",
      },
    });
  });

  it("422 com ano fora da faixa", async () => {
    const r = await app.inject({
      url: "/api/v1/calendario?ano=1999",
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toMatchObject({ erro: { codigo: "ENTRADA_INVALIDA" } });
  });

  it("200 com feriados do ano, unidades, contagem e próximo", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.unidades.push({
      id: crypto.randomUUID(),
      empresaId,
      nome: "Campinas",
      cidade: "Campinas",
      uf: "SP",
      ativo: true,
    });
    cenario.banco.feriados.push(
      {
        id: crypto.randomUUID(),
        empresaId: null,
        data: "2026-11-20",
        tipo: "nacional",
        cidade: null,
        uf: null,
        descricao: "Consciência Negra",
        geradoAutomaticamente: true,
      },
      {
        id: crypto.randomUUID(),
        empresaId: crypto.randomUUID(),
        data: "2026-11-21",
        tipo: "municipal",
        cidade: "X",
        uf: "SP",
        descricao: "De outra empresa",
        geradoAutomaticamente: false,
      },
    );
    const r = await app.inject({ url: "/api/v1/calendario?ano=2026", headers });
    expect(r.statusCode).toBe(200);
    const corpo = r.json<Record<string, unknown>>();
    expect(corpo).toMatchObject({
      ano: 2026,
      contagens: { nacional: 1, estadual: 0, municipal: 0 },
      proximo: { descricao: "Consciência Negra" },
      unidades: [{ nome: "Campinas" }],
    });
    expect(corpo["feriados"]).toHaveLength(1);
    expect(JSON.stringify(corpo)).not.toContain("empresaId");
    expect(cenario.banco.contextos.at(-1)).toMatchObject({ empresaId, plataforma: false });
  });
});

describe("escrita de feriados", () => {
  it("403 para quem só tem Ver no Calendário", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/calendario/feriados",
      headers: await comoPapel("operador"),
      payload: FERIADO,
    });
    expect(r.statusCode).toBe(403);
  });

  it("422 de regra: municipal sem cidade", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/calendario/feriados",
      headers: await comoPapel("admin"),
      payload: { ...FERIADO, cidade: null },
    });
    expect(r.statusCode).toBe(422);
    expect(r.json()).toEqual({
      erro: {
        codigo: "ENTRADA_INVALIDA",
        mensagem: "Cidade e UF são obrigatórios para feriado municipal",
      },
    });
  });

  it("admin cria recorrente, altera, e apaga; tudo auditado", async () => {
    const headers = await comoPapel("admin");
    const criado = await app.inject({
      method: "POST",
      url: "/api/v1/calendario/feriados",
      headers,
      payload: { ...FERIADO, recorrente: true, anosAFrente: 2 },
    });
    expect(criado.json()).toEqual({ inseridos: 3, atualizados: 0 });

    const id = cenario.banco.feriados[0]?.id ?? "";
    const alterado = await app.inject({
      method: "PUT",
      url: `/api/v1/calendario/feriados/${id}`,
      headers,
      payload: { ...FERIADO, descricao: "Padroeira (nova)" },
    });
    expect(alterado.json()).toEqual({ inseridos: 0, atualizados: 1 });

    const apagado = await app.inject({
      method: "DELETE",
      url: `/api/v1/calendario/feriados/${id}`,
      headers,
    });
    expect(apagado.json()).toEqual({ ok: true });
    expect(cenario.banco.auditoria.map((a) => a.acao)).toEqual(["criar", "alterar", "excluir"]);
  });

  it("feriado nacional: a empresa não altera (aviso), a Plataforma altera", async () => {
    const id = crypto.randomUUID();
    cenario.banco.feriados.push({
      id,
      empresaId: null,
      data: "2026-12-25",
      tipo: "nacional",
      cidade: null,
      uf: null,
      descricao: "Natal",
      geradoAutomaticamente: true,
    });
    const payload = { data: "2026-12-25", tipo: "nacional", descricao: "Natal!" };

    const daEmpresa = await app.inject({
      method: "PUT",
      url: `/api/v1/calendario/feriados/${id}`,
      headers: await comoPapel("admin"),
      payload,
    });
    expect(daEmpresa.statusCode).toBe(403);
    expect(daEmpresa.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain(
      "só a equipe da Plataforma",
    );

    const plataforma = cenario.banco.criarUsuario({ email: "scale@scaleia.ai" });
    cenario.banco.plataformaAdmins.add(plataforma.id);
    const daPlataforma = await app.inject({
      method: "PUT",
      url: `/api/v1/calendario/feriados/${id}`,
      headers: await entrarComo(cenario, plataforma.id, empresaId),
      payload,
    });
    expect(daPlataforma.statusCode).toBe(200);
  });

  it("409 com mensagem para o operador ao repetir um feriado", async () => {
    const headers = await comoPapel("admin");
    const criar = () =>
      app.inject({ method: "POST", url: "/api/v1/calendario/feriados", headers, payload: FERIADO });
    expect((await criar()).statusCode).toBe(200);
    const repetido = await criar();
    expect(repetido.statusCode).toBe(409);
    expect(repetido.json()).toEqual({
      erro: { codigo: "CONFLITO", mensagem: "Já existe um feriado igual nesta data." },
    });
  });

  it("404 para feriado que não existe e 422 para id que não é uuid", async () => {
    const headers = await comoPapel("admin");
    const inexistente = await app.inject({
      method: "DELETE",
      url: `/api/v1/calendario/feriados/${crypto.randomUUID()}`,
      headers,
    });
    expect(inexistente.statusCode).toBe(404);
    const invalido = await app.inject({
      method: "DELETE",
      url: "/api/v1/calendario/feriados/abc",
      headers,
    });
    expect(invalido.statusCode).toBe(422);
  });

  it("gerar nacionais: admin da empresa não pode (vale para todas, Q28); a Plataforma gera uma vez", async () => {
    const gerar = (headers: Record<string, string>) =>
      app.inject({
        method: "POST",
        url: "/api/v1/calendario/feriados-nacionais",
        headers,
        payload: { ano: 2026 },
      });
    const daEmpresa = await gerar(await comoPapel("admin"));
    expect(daEmpresa.statusCode).toBe(403);

    const plataforma = cenario.banco.criarUsuario({ email: "suporte@plataforma.com" });
    cenario.banco.plataformaAdmins.add(plataforma.id);
    const headers = await entrarComo(cenario, plataforma.id, empresaId);
    expect((await gerar(headers)).json()).toEqual({
      inseridos: 65,
      existiam: 0,
      anos: [2026, 2027, 2028, 2029, 2030],
    });
    expect((await gerar(headers)).json()).toMatchObject({ inseridos: 0, existiam: 65 });
    expect(
      cenario.banco.feriados.every((f) => f.empresaId === null && f.geradoAutomaticamente),
    ).toBe(true);
  });
});

describe("feriados gerais (Plataforma › Configurações)", () => {
  const GERAL = { data: "2026-11-20", tipo: "nacional", descricao: "Consciência Negra" };

  async function comoPlataforma() {
    const plataforma = cenario.banco.criarUsuario({ email: "suporte@plataforma.com" });
    cenario.banco.plataformaAdmins.add(plataforma.id);
    return entrarComo(cenario, plataforma.id, empresaId);
  }

  it("403 para o admin da empresa, em leitura e escrita", async () => {
    const headers = await comoPapel("admin");
    const ler = await app.inject({ url: "/api/v1/calendario/feriados-gerais?ano=2026", headers });
    expect(ler.statusCode).toBe(403);
    const criar = await app.inject({
      method: "POST",
      url: "/api/v1/calendario/feriados-gerais",
      headers,
      payload: GERAL,
    });
    expect(criar.statusCode).toBe(403);
    expect(cenario.banco.feriados).toEqual([]);
  });

  it("a Plataforma lista só os gerais e cria, altera e exclui com empresa nula; auditado", async () => {
    const headers = await comoPlataforma();
    const daEmpresa = await app.inject({
      method: "POST",
      url: "/api/v1/calendario/feriados",
      headers,
      payload: FERIADO,
    });
    expect(daEmpresa.statusCode).toBe(200);

    const criado = await app.inject({
      method: "POST",
      url: "/api/v1/calendario/feriados-gerais",
      headers,
      payload: GERAL,
    });
    expect(criado.json()).toEqual({ inseridos: 1, atualizados: 0 });
    const listar = () =>
      app.inject({ url: "/api/v1/calendario/feriados-gerais?ano=2026", headers });
    const lista = (await listar()).json<{ feriados: { id: string; descricao: string }[] }>();
    expect(lista.feriados.map((f) => f.descricao)).toEqual(["Consciência Negra"]);
    const id = lista.feriados[0]?.id ?? "";
    expect(cenario.banco.feriados.find((f) => f.id === id)?.empresaId).toBeNull();

    const alterado = await app.inject({
      method: "PUT",
      url: `/api/v1/calendario/feriados-gerais/${id}`,
      headers,
      payload: { ...GERAL, descricao: "Dia da Consciência Negra" },
    });
    expect(alterado.statusCode).toBe(200);
    const apagado = await app.inject({
      method: "DELETE",
      url: `/api/v1/calendario/feriados-gerais/${id}`,
      headers,
    });
    expect(apagado.json()).toEqual({ ok: true });
    expect((await listar()).json()).toEqual({ feriados: [] });
    expect(cenario.banco.auditoria.filter((a) => a.empresaId === null).map((a) => a.acao)).toEqual([
      "criar",
      "alterar",
      "excluir",
    ]);
  });

  it("feriado da empresa não é alcançado pelas rotas dos gerais (404)", async () => {
    const headers = await comoPlataforma();
    await app.inject({
      method: "POST",
      url: "/api/v1/calendario/feriados",
      headers,
      payload: FERIADO,
    });
    const daEmpresa = cenario.banco.feriados[0]?.id ?? "";
    const r = await app.inject({
      method: "DELETE",
      url: `/api/v1/calendario/feriados-gerais/${daEmpresa}`,
      headers,
    });
    expect(r.statusCode).toBe(404);
    expect(cenario.banco.feriados).toHaveLength(1);
  });
});

describe("erros de infraestrutura", () => {
  it("timeout de consulta vira 503 pedindo para filtrar mais", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.falharCom = Object.assign(
      new Error("canceling statement due to statement timeout"),
      { code: "57014" },
    );
    const r = await app.inject({ url: "/api/v1/calendario?ano=2026", headers });
    expect(r.statusCode).toBe(503);
    expect(r.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain("Reduza o período");
  });

  it("erro inesperado vira 500 sem detalhe interno", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.falharCom = new Error("detalhe secreto do banco");
    const r = await app.inject({ url: "/api/v1/calendario?ano=2026", headers });
    expect(r.statusCode).toBe(500);
    expect(r.body).not.toContain("secreto");
    expect(r.json()).toMatchObject({ erro: { codigo: "ERRO_INTERNO" } });
  });
});
