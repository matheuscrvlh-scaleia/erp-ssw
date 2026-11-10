import { randomBytes, randomUUID } from "node:crypto";

import { cifrarSegredo, lerChavesDeSegredo } from "@erp/db/segredos";
import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { criarClienteAhgora } from "../../infra/ahgora";
import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import {
  apurarPeriodo,
  calcularHorasExtras,
  contextoDoSegredo,
  credencialDaIntegracao,
  type IntegracaoAhgora,
} from "./casos-de-uso";

const CHAVES = lerChavesDeSegredo(`1:${randomBytes(32).toString("base64")}`, 1);

type Rota = (url: URL) => { status?: number; corpo: unknown };

/** HTTP falso: responde por caminho e guarda as chamadas. */
function httpFalso(rotas: Record<string, Rota>) {
  const chamadas: { url: URL; autorizacao: string | null }[] = [];
  const http: typeof fetch = (entrada, init) => {
    const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
    chamadas.push({ url, autorizacao: new Headers(init?.headers).get("authorization") });
    const rota = rotas[url.pathname];
    if (!rota) return Promise.resolve(new Response("não existe", { status: 404 }));
    const { status = 200, corpo } = rota(url);
    const texto = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
    return Promise.resolve(new Response(texto, { status }));
  };
  return { http, chamadas };
}

function integracao(dados: Partial<IntegracaoAhgora> = {}): IntegracaoAhgora {
  return {
    empresaNome: "FR",
    empresaStatus: "ativa",
    ativo: true,
    parametros: { usuario: "api.fr" },
    segredo: null,
    ...dados,
  };
}

describe("credencial do Ahgora", () => {
  const deps = { segredos: CHAVES, ambiente: { usuario: "env.user", senha: "env.senha" } };

  it("usuário do parâmetro e senha do cofre (decifrada com o contexto da empresa)", () => {
    const segredo = cifrarSegredo(CHAVES, "s3nha", contextoDoSegredo("e1", "ahgora"));
    expect(credencialDaIntegracao("e1", integracao({ segredo }), deps)).toEqual({
      usuario: "api.fr",
      senha: "s3nha",
    });
  });

  it("sem cofre, o ambiente só vale com usar_env", () => {
    expect(() => credencialDaIntegracao("e1", integracao(), deps)).toThrow(
      "Credenciais do Ahgora não configuradas para esta empresa.",
    );
    expect(
      credencialDaIntegracao("e1", integracao({ parametros: { usar_env: "true" } }), deps),
    ).toEqual({ usuario: "env.user", senha: "env.senha" });
  });

  it("empresa inexistente, parada ou com a integração desligada", () => {
    expect(() => credencialDaIntegracao("e1", null, deps)).toThrow('Empresa "e1" não encontrada.');
    expect(() =>
      credencialDaIntegracao("e1", integracao({ empresaStatus: "suspensa" }), deps),
    ).toThrow("Empresa FR está suspensa: a ingestão não roda.");
    expect(() => credencialDaIntegracao("e1", integracao({ ativo: null }), deps)).toThrow(
      "A integração ahgora da empresa FR está desligada.",
    );
  });
});

describe("cliente HTTP do Ahgora", () => {
  const credencial = { usuario: "u", senha: "p" };

  it("Basic auth, paginação por nextPageId e erro com o corpo da resposta", async () => {
    const { http, chamadas } = httpFalso({
      "/employees": (url) =>
        url.searchParams.get("nextPageId")
          ? { corpo: { data: [{ id: "2", register: "2", name: "B" }] } }
          : { corpo: { data: [{ id: "1", register: "1", name: "A" }], nextPageId: "p2" } },
      "/shifts": () => ({ status: 500, corpo: "x".repeat(600) }),
    });
    const cliente = criarClienteAhgora(credencial, http);
    expect((await cliente.todosOsFuncionarios()).map((f) => f.name)).toEqual(["A", "B"]);
    expect(chamadas[0]?.autorizacao).toBe(`Basic ${Buffer.from("u:p").toString("base64")}`);
    await expect(cliente.turnos()).rejects.toThrow(
      `Erro na API do Ahgora (HTTP 500): ${"x".repeat(500)}`,
    );
  });

  it("401/403 vira acesso negado; falha de rede e tempo esgotado viram mensagem ao operador", async () => {
    const negado = criarClienteAhgora(
      credencial,
      httpFalso({ "/shifts": () => ({ status: 401, corpo: "" }) }).http,
    );
    await expect(negado.turnos()).rejects.toThrow(
      "Acesso negado pela API do Ahgora. Verifique as credenciais configuradas.",
    );
    const semRede = criarClienteAhgora(credencial, () => Promise.reject(new Error("ECONNRESET")));
    await expect(semRede.turnos()).rejects.toThrow(
      "Falha ao consultar a API do Ahgora: ECONNRESET",
    );
    const lento = criarClienteAhgora(credencial, () =>
      Promise.reject(new DOMException("tempo", "TimeoutError")),
    );
    await expect(lento.turnos()).rejects.toThrow(
      "Tempo limite excedido ao consultar a API do Ahgora.",
    );
  });
});

describe("apuração e hora extra", () => {
  const batida = (dia: string, hora: string) => ({
    punchTime: `${dia}T${hora}:00.000-03:00`,
    type: "ORIGINAL",
  });

  it("limite de 150 colaboradores por apuração", async () => {
    const muitos = Array.from({ length: 151 }, (_, i) => ({
      id: `${i}`,
      register: `${i}`,
      name: `N${i}`,
    }));
    const cliente = criarClienteAhgora(
      { usuario: "u", senha: "p" },
      httpFalso({ "/employees": () => ({ corpo: { data: muitos } }) }).http,
    );
    await expect(
      apurarPeriodo(cliente, { inicio: "2026-10-01", fim: "2026-10-31", incluirDemitidos: false }),
    ).rejects.toThrow("A seleção tem 151 colaboradores e o limite por apuração é 150.");
  });

  it("hora extra pela escala: 545 min num turno de 528 + 10 de tolerância", async () => {
    const cliente = criarClienteAhgora(
      { usuario: "u", senha: "p" },
      httpFalso({
        "/employees": () => ({
          corpo: { data: [{ id: "9", register: "77", name: "João da Silva" }] },
        }),
        "/shifts": () => ({
          corpo: {
            data: [
              {
                key: "T1",
                officeHours: ["08:00", "12:00", "13:00", "17:48"],
                lateExitTolerance: "00:10",
              },
            ],
          },
        }),
        "/schedulesAndShifts/between": () => ({
          corpo: { data: [{ date: "2026-11-03", shift: "T1" }] },
        }),
        "/punches/between": (url) => {
          expect(url.searchParams.get("employeeRegister")).toBe("77");
          return {
            corpo: {
              data: [
                batida("2026-11-03", "08:00"),
                batida("2026-11-03", "12:00"),
                batida("2026-11-03", "13:00"),
                batida("2026-11-03", "18:05"),
                batida("2026-11-04", "08:00"),
              ],
              total: 5,
            },
          };
        },
      }).http,
    );
    const horas = await calcularHorasExtras(cliente, {
      inicio: "2026-11-01",
      fim: "2026-11-30",
      nomes: ["JOAO DA SILVA", "AGREGADO"],
    });
    expect(horas).toEqual([
      { nome: "JOAO DA SILVA", data: "2026-11-03", horaExtra: true },
      { nome: "JOAO DA SILVA", data: "2026-11-04", horaExtra: null },
    ]);
  });
});

describe("rotas do Ahgora", () => {
  let cenario: Cenario;
  let app: FastifyInstance;
  let empresaId: string;
  const { http } = httpFalso({
    "/employees": () => ({
      corpo: { data: [{ id: "1", register: "1", name: "Ana", department: "Entrega" }] },
    }),
  });

  beforeEach(async () => {
    cenario = criarCenario();
    app = await construirAppDeTeste(cenario, null, {
      ahgora: { segredos: CHAVES, ambiente: {}, http },
    });
    empresaId = cenario.banco.criarEmpresa().id;
    const segredo = cifrarSegredo(CHAVES, "s3nha", contextoDoSegredo(empresaId, "ahgora"));
    cenario.banco.ranking.integracoes.set(empresaId, integracao({ segredo }));
  });
  afterEach(() => app.close());

  async function entrar(plataforma: boolean) {
    const usuario = cenario.banco.criarUsuario({ email: `${randomUUID()}@fr.com.br` });
    cenario.banco.vincular(usuario.id, empresaId, { papel: "admin" });
    if (plataforma) cenario.banco.plataformaAdmins.add(usuario.id);
    return entrarComo(cenario, usuario.id, empresaId);
  }

  it("só a Plataforma consulta; admin da empresa recebe 403", async () => {
    const negado = await app.inject({
      url: "/api/v1/ahgora/departamentos",
      headers: await entrar(false),
    });
    expect(negado.statusCode).toBe(403);
    const r = await app.inject({
      url: "/api/v1/ahgora/departamentos",
      headers: await entrar(true),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual(["Entrega"]);
  });

  it("422 com período de batidas acima de 30 dias", async () => {
    const r = await app.inject({
      url: "/api/v1/ahgora/batidas?employeeId=1&start=2026-09-01&end=2026-10-31",
      headers: await entrar(true),
    });
    expect(r.statusCode).toBe(422);
  });
});
