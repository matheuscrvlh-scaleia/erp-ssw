import { type LinhaLista } from "@erp/shared/contratos/listagem";
import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;

const UNIDADE = "6f1c2a3b-0000-4000-8000-000000000001";

beforeEach(async () => {
  cenario = criarCenario();
  app = await construirAppDeTeste(cenario);
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "performance");
  cenario.banco.definirCargo(empresaId, "operador", { rotulo: "Operador", telas: ["performance"] });
  cenario.banco.definirCargo(empresaId, "rh", { rotulo: "RH", telas: ["calendario"] });
  cenario.banco.ctrc.codigos = [
    {
      codigo: 13,
      descricao: "ENTREGA PREJUDICADA",
      tipoSsw: "PENDENCIA_TRANSPORTADORA",
      penaliza: true,
      pendenciaAcompanhada: true,
    },
    {
      codigo: 12,
      descricao: "DEVOLUÇÃO",
      tipoSsw: "BAIXA",
      penaliza: false,
      pendenciaAcompanhada: false,
    },
  ];
});
afterEach(() => app.close());

async function comoPapel(papel: string) {
  const usuario = cenario.banco.criarUsuario({ email: `${papel}@fr.com.br` });
  cenario.banco.vincular(usuario.id, empresaId, { papel });
  return entrarComo(cenario, usuario.id, empresaId);
}

function linha(numero: string): LinhaLista {
  return {
    id: crypto.randomUUID(),
    sigla: "CAP",
    numero,
    numeroNf: 456,
    destinatario: "CLIENTE",
    cidadeDestino: "CAMPINAS",
    bairroDestino: null,
    setor: null,
    setorDestino: null,
    unidadeDestino: "CAP",
    codigo: 13,
    descricao: "ENTREGA PREJUDICADA",
    dataOcorrencia: "2026-11-05T12:00:00.000Z",
    placa: null,
    dataEmissao: "2026-11-01",
    dataPrevista: "2026-11-05",
    dataEntrega: null,
    dataEmbarque: null,
    parceiroNome: null,
    pagadorNome: null,
    remetente: null,
    tipoDocumento: "NORMAL",
    peso: 10.5,
    valorFrete: 100,
    volumes: 1,
    localizacao: null,
    primeiroManifesto: null,
    ultimoManifesto: null,
    valorMercadoria: null,
    atrasoDias: 5,
    performanceDias: null,
    noPrazo: null,
    responsabilidadeCliente: null,
    tde: null,
  };
}

const LISTA = "/api/v1/performance/lista";

describe("GET /api/v1/performance/lista", () => {
  it("401 sem sessão", async () => {
    const r = await app.inject({ url: LISTA });
    expect(r.statusCode).toBe(401);
  });

  it("403 sem a tela Performance e 403 com o módulo desligado", async () => {
    const semTela = await app.inject({ url: LISTA, headers: await comoPapel("rh") });
    expect(semTela.statusCode).toBe(403);
    expect(semTela.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });

    cenario.banco.liberacoes = [];
    const semModulo = await app.inject({ url: LISTA, headers: await comoPapel("operador") });
    expect(semModulo.statusCode).toBe(403);
    expect(semModulo.json()).toMatchObject({ erro: { codigo: "MODULO_NAO_LIBERADO" } });
  });

  it("422 com recorte desconhecido, página zero ou página grande demais", async () => {
    const headers = await comoPapel("operador");
    for (const query of ["tipo=xyz", "pagina=0", "porPagina=501", "inicio=2026-02-30"]) {
      const r = await app.inject({ url: `${LISTA}?${query}`, headers });
      expect(r.statusCode, query).toBe(422);
      expect(r.json()).toMatchObject({ erro: { codigo: "ENTRADA_INVALIDA" } });
    }
  });

  it("200: lista, total certo e gráficos com o mesmo filtro; listas da URL viram arrays", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.listagem.paginaDeLinhas = [linha("1"), linha("2")];
    cenario.banco.listagem.resultadoDosAgregados = {
      total: 250,
      porCodigo: [{ codigo: 13, descricao: null, qtd: 7 }],
      porUnidade: [{ unidade: "CAP", qtd: 250 }],
      porCidade: [{ cidade: "CAMPINAS", qtd: 3 }],
      porAtraso: [
        { atraso: 2, qtd: 4 },
        { atraso: 40, qtd: 1 },
      ],
    };
    const r = await app.inject({
      url: `${LISTA}?tipo=atrasados&unidades=CAP&unidades=${UNIDADE}&codigos=13&pagina=3&inicio=2026-11-01&fim=2026-11-10`,
      headers,
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      total: 250,
      porCodigo: [{ codigo: 13, descricao: "ENTREGA PREJUDICADA", qtd: 7 }],
      porFaixa: [
        { faixa: "Até 3 dias", min: 1, max: 3, qtd: 4 },
        { faixa: "+30 dias", min: 31, max: null, qtd: 1 },
      ],
    });
    expect(r.json<{ linhas: unknown[] }>().linhas).toHaveLength(2);

    const { filtros, paginas, pediuAtraso } = cenario.banco.listagem;
    expect(paginas).toEqual([{ limite: 100, deslocamento: 200 }]);
    expect(pediuAtraso).toEqual([true]);
    // Lista e gráficos receberam o mesmo filtro.
    expect(filtros[0]).toEqual(filtros[1]);
    expect(filtros[0]).toMatchObject({
      siglas: ["CAP"],
      unidadesIds: [UNIDADE],
      codigos: [13],
      recortes: ["atrasados"],
      periodo: { base: "emissao", inicio: "2026-11-01", fim: "2026-11-10" },
      hoje: "2026-11-10",
      codigosDoCatalogo: { baixas: [12], acompanhados: [13] },
    });
    expect(cenario.banco.contextos.at(-1)).toMatchObject({ empresaId });
  });

  it("filial que não é própria: lista vazia sem consultar (Q10)", async () => {
    const r = await app.inject({
      url: `${LISTA}?filiais=XYZ`,
      headers: await comoPapel("operador"),
    });
    expect(r.json()).toEqual({
      linhas: [],
      total: 0,
      porCodigo: [],
      porUnidade: [],
      porCidade: [],
      porFaixa: [],
    });
    expect(cenario.banco.listagem.filtros).toEqual([]);
  });

  it("timeout da consulta pede para reduzir o período", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.listagem.agregados = () =>
      Promise.reject(Object.assign(new Error("canceling statement"), { code: "57014" }));
    const r = await app.inject({ url: LISTA, headers });
    expect(r.statusCode).toBe(503);
    expect(r.json<{ erro: { mensagem: string } }>().erro.mensagem).toContain("Reduza o período");
  });
});

describe("GET /api/v1/performance/lista/exportacao", () => {
  it("páginas grandes com aviso de que há mais (nada cortado em silêncio)", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.listagem.paginaDeLinhas = [linha("1"), linha("2"), linha("3")];
    const r = await app.inject({
      url: "/api/v1/performance/lista/exportacao?porPagina=2&pagina=2",
      headers,
    });
    expect(r.json()).toMatchObject({ temMais: true });
    expect(r.json<{ linhas: unknown[] }>().linhas).toHaveLength(2);
    expect(cenario.banco.listagem.paginas).toEqual([{ limite: 3, deslocamento: 2 }]);
  });

  it("422 acima de 5000 por página", async () => {
    const r = await app.inject({
      url: "/api/v1/performance/lista/exportacao?porPagina=5001",
      headers: await comoPapel("operador"),
    });
    expect(r.statusCode).toBe(422);
  });
});

describe("GET /api/v1/performance/lista/codigos", () => {
  it("códigos do recorte com tipo, penaliza e descrição do catálogo", async () => {
    const headers = await comoPapel("operador");
    cenario.banco.listagem.contagens = [
      { codigo: 13, descricao: null, qtd: 9 },
      { codigo: 77, descricao: "OUTRO", qtd: 1 },
    ];
    const r = await app.inject({ url: "/api/v1/performance/lista/codigos?codigos=77", headers });
    expect(r.json()).toEqual([
      {
        codigo: 13,
        descricao: "ENTREGA PREJUDICADA",
        qtd: 9,
        tipo: "PENDENCIA_TRANSPORTADORA",
        penaliza: true,
      },
      { codigo: 77, descricao: "OUTRO", qtd: 1, tipo: null, penaliza: false },
    ]);
  });
});
