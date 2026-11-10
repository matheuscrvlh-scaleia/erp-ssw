import { randomUUID } from "node:crypto";

import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "historico");
  const telas = ["historico", "admin_historico"];
  cenario.banco.definirCargo(empresaId, "admin", { rotulo: "Admin", telas });
  cenario.banco.definirCargo(empresaId, "operador", { rotulo: "Op", telas: ["historico"] });
});
afterEach(() => app.close());

async function comoPapel(papel: string, nome = papel) {
  const usuario = cenario.banco.criarUsuario({ email: `${nome}@fr.com.br`, nome });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

const ANOTACAO = { data: "2026-11-05", tipo: "clima", texto: "  Chuva forte  ", unidadeId: null };

describe("anotações", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({ url: "/api/v1/historico?inicio=2026-11-01&fim=2026-11-30" });
    expect(r.statusCode).toBe(401);
  });

  it("422 com texto vazio", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/historico/anotacoes",
      headers: await comoPapel("operador"),
      payload: { ...ANOTACAO, texto: "   " },
    });
    expect(r.statusCode).toBe(422);
  });

  it("autor cria e edita; outro operador recebe 403 (Q09); admin exclui; tudo auditado", async () => {
    const autor = await comoPapel("operador", "Ana");
    const criada = await app.inject({
      method: "POST",
      url: "/api/v1/historico/anotacoes",
      headers: autor,
      payload: ANOTACAO,
    });
    expect(criada.statusCode).toBe(200);
    const { id } = criada.json<{ id: string }>();

    const lida = await app.inject({
      url: "/api/v1/historico?inicio=2026-11-01&fim=2026-11-30",
      headers: autor,
    });
    expect(lida.json()).toMatchObject({
      anotacoes: [{ id, texto: "Chuva forte", autorNome: "Ana" }],
      totais: { anotacoes: 1, feriados: 0, diasComContexto: 1 },
      truncado: false,
    });

    const outro = await comoPapel("operador", "Bia");
    const negada = await app.inject({
      method: "PUT",
      url: `/api/v1/historico/anotacoes/${id}`,
      headers: outro,
      payload: { ...ANOTACAO, texto: "Outra coisa" },
    });
    expect(negada.statusCode).toBe(403);
    expect(negada.json()).toMatchObject({
      erro: { mensagem: "Só o autor ou um administrador pode alterar esta anotação." },
    });

    const editada = await app.inject({
      method: "PUT",
      url: `/api/v1/historico/anotacoes/${id}`,
      headers: autor,
      payload: { ...ANOTACAO, texto: "Chuva e alagamento" },
    });
    expect(editada.statusCode).toBe(200);

    const excluida = await app.inject({
      method: "DELETE",
      url: `/api/v1/historico/anotacoes/${id}`,
      headers: await comoPapel("admin"),
    });
    expect(excluida.statusCode).toBe(200);
    expect(cenario.banco.auditoria.map((a) => [a.entidade, a.acao])).toEqual([
      ["anotacao", "criar"],
      ["anotacao", "alterar"],
      ["anotacao", "excluir"],
    ]);
  });

  it("unidade de outra empresa é recusada", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/historico/anotacoes",
      headers: await comoPapel("operador"),
      payload: { ...ANOTACAO, unidadeId: randomUUID() },
    });
    expect(r.json()).toMatchObject({ erro: { mensagem: "Unidade não encontrada." } });
  });
});

describe("Histórico › Feriados", () => {
  it("403 para quem não é admin", async () => {
    const r = await app.inject({
      url: "/api/v1/historico/feriados?ano=2026",
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(403);
  });

  it("importa os 9 nacionais fixos na empresa (pula o que já existe) e lista", async () => {
    const headers = await comoPapel("admin");
    cenario.banco.feriados.push({
      id: randomUUID(),
      empresaId: null,
      data: "2027-12-25",
      tipo: "nacional",
      cidade: null,
      uf: null,
      descricao: "Natal",
      geradoAutomaticamente: true,
    });
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/historico/feriados-nacionais",
      headers,
      payload: { ano: 2027 },
    });
    expect(r.json()).toEqual({ inseridos: 8 });
    expect(cenario.banco.feriados.filter((f) => f.empresaId === empresaId)).toHaveLength(8);

    const lista = await app.inject({ url: "/api/v1/historico/feriados?ano=2027", headers });
    const feriados = lista.json<{ feriados: { data: string; global: boolean }[] }>().feriados;
    expect(feriados).toHaveLength(9);
    expect(feriados[0]).toMatchObject({ data: "2027-12-25", global: true });
  });

  it("feriado nacional global não é alterado por admin de empresa", async () => {
    const id = randomUUID();
    cenario.banco.feriados.push({
      id,
      empresaId: null,
      data: "2026-11-20",
      tipo: "nacional",
      cidade: null,
      uf: null,
      descricao: "Consciência Negra",
      geradoAutomaticamente: true,
    });
    const r = await app.inject({
      method: "DELETE",
      url: `/api/v1/historico/feriados/${id}`,
      headers: await comoPapel("admin"),
    });
    expect(r.statusCode).toBe(403);
  });

  it("feriado repetido avisa em português (Q10)", async () => {
    const headers = await comoPapel("admin");
    const feriado = {
      data: "2026-08-15",
      tipo: "municipal",
      cidade: "Campinas",
      uf: "SP",
      descricao: "Padroeira",
    };
    const url = "/api/v1/historico/feriados";
    expect((await app.inject({ method: "POST", url, headers, payload: feriado })).json()).toEqual({
      inseridos: 1,
    });
    const repetido = await app.inject({ method: "POST", url, headers, payload: feriado });
    expect(repetido.statusCode).toBe(409);
    expect(repetido.json()).toMatchObject({
      erro: { mensagem: "Já existe um feriado igual nesta data." },
    });
  });
});
