import { randomBytes, randomUUID } from "node:crypto";

import {
  cifrarSegredo,
  contextoDoSegredo,
  decifrarSegredo,
  lerChavesDeSegredo,
} from "@erp/db/segredos";
import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import { type FilasDeIngestao, type ResultadoDaExecucao } from "./casos-de-uso";
import { LIMITE_DE_FALHAS_POR_MINUTO } from "./rotas-publicas";
import { resumoDoSegredo } from "./webhook";

const chaves = lerChavesDeSegredo(`1:${randomBytes(32).toString("base64")}`, 1);
const SEGREDO_WEBHOOK = "s".repeat(40);

class FilasFalsas implements FilasDeIngestao {
  enfileirados: {
    job: string;
    dados: Readonly<Record<string, unknown>>;
    deduplicar: string | null;
  }[] = [];
  resultado: ResultadoDaExecucao = { tipo: "pendente" };
  esquecidos: string[] = [];
  falhar = false;
  /** Simula o worker rodando logo que o job entra na fila. */
  aoEnfileirar: (dados: Readonly<Record<string, unknown>>) => void = () => undefined;

  enfileirar(
    job: string,
    dados: Readonly<Record<string, unknown>>,
    { deduplicar }: { deduplicar: string | null },
  ) {
    if (this.falhar) return Promise.reject(new Error("redis fora"));
    this.enfileirados.push({ job, dados, deduplicar });
    this.aoEnfileirar(dados);
    return Promise.resolve(`job-${this.enfileirados.length}`);
  }
  aguardar() {
    return Promise.resolve(this.resultado);
  }
  status() {
    return Promise.resolve({
      agendado: true,
      proximaExecucao: null,
      aguardando: 0,
      ativos: 0,
      atrasados: 0,
      falhos: 0,
      ultimaConclusao: null,
      ultimasFalhas: [],
    });
  }
  tokenSswGeradoEm() {
    return Promise.resolve(null);
  }
  esquecerTokenSsw(empresaId: string) {
    this.esquecidos.push(empresaId);
    return Promise.resolve();
  }
}

let cenario: Cenario;
let app: FastifyInstance;
let filas: FilasFalsas;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  filas = new FilasFalsas();
  app = await construirAppDeTeste(cenario, null, {
    filasDeIngestao: filas,
    chavesDeSegredo: chaves,
  });
  empresaId = cenario.banco.criarEmpresa().id;
  cenario.banco.liberarModulo(empresaId, "integracao_ssw");
  cenario.banco.definirCargo(empresaId, "admin", { rotulo: "Admin", telas: ["admin_ingestao"] });
});
afterEach(() => app.close());

async function adminDaEmpresa() {
  const u = cenario.banco.criarUsuario({ email: "admin@fr.com.br" });
  cenario.banco.vincular(u.id, empresaId, { papel: "admin" });
  return entrarComo(cenario, u.id, empresaId);
}

async function plataforma() {
  const u = cenario.banco.criarUsuario({ email: "plataforma@scale.com.br" });
  cenario.banco.plataformaAdmins.add(u.id);
  return entrarComo(cenario, u.id, empresaId);
}

describe("Admin › Ingestão SSW", () => {
  it("401 sem sessão e 403 para o admin da empresa (tela só da Plataforma)", async () => {
    const semSessao = await app.inject({ url: "/api/v1/admin/ingestao/bi2-0017" });
    expect(semSessao.statusCode).toBe(401);

    const admin = await app.inject({
      url: "/api/v1/admin/ingestao/bi2-0017",
      headers: await adminDaEmpresa(),
    });
    expect(admin.statusCode).toBe(403);
    expect(admin.json()).toMatchObject({ erro: { codigo: "SEM_PERMISSAO" } });
  });

  it("422 com data inválida no BI2 manual", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/ingestao/bi2-0017/rodar",
      headers: await plataforma(),
      payload: { data: "10/11/2026" },
    });
    expect(r.statusCode).toBe(422);
  });

  it("BI2 manual vai para a fila da empresa ativa e fica auditado", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/ingestao/bi2-0017/rodar",
      headers: await plataforma(),
      payload: { data: "2026-11-09" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ enfileirado: true, pendente: true, resultado: null });
    expect(filas.enfileirados).toEqual([
      {
        job: "bi2_0017",
        dados: { empresaId, modo: "manual", data: "2026-11-09", lookback: 0 },
        deduplicar: null,
      },
    ]);
    expect(cenario.banco.auditoria.at(-1)).toMatchObject({ entidade: "bi2_0017", empresaId });
  });

  it("salvar credenciais cifra a senha com o contexto da empresa e invalida o token", async () => {
    const headers = await plataforma();
    const r = await app.inject({
      method: "PUT",
      url: "/api/v1/admin/ingestao/ssw-api",
      headers,
      payload: { dominio: "frt", usuario: "api", senha: "senha-secreta" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ tokenInvalidado: true });
    expect(filas.esquecidos).toEqual([empresaId]);

    const gravada = cenario.banco.ingestao.integracoes.get(`${empresaId}:ssw_api`);
    expect(gravada?.parametros).toEqual({ dominio: "frt", usuario: "api" });
    const segredo = gravada?.segredo;
    if (!segredo) throw new Error("segredo não gravado");
    expect(segredo.cifrado).not.toContain("senha-secreta");
    expect(decifrarSegredo(chaves, segredo, contextoDoSegredo(empresaId, "ssw_api"))).toBe(
      "senha-secreta",
    );
    expect(JSON.stringify(cenario.banco.auditoria)).not.toContain("senha-secreta");

    const lidas = await app.inject({ url: "/api/v1/admin/ingestao/ssw-api", headers });
    expect(lidas.json()).toMatchObject({
      dominio: "frt",
      usuario: "api",
      temSenha: true,
      tokenStatus: "ausente",
    });
  });

  it("selo de atualização: horário para todos, XML aguardando só para a Plataforma", async () => {
    cenario.banco.ingestao.ultimaAplicacao = new Date("2026-11-10T11:30:00Z");
    const admin = await app.inject({
      url: "/api/v1/ssw/atualizacao",
      headers: await adminDaEmpresa(),
    });
    expect(admin.json()).toEqual({
      atualizadoEm: "2026-11-10T11:30:00.000Z",
      xmlAguardando: null,
    });
    const plat = await app.inject({ url: "/api/v1/ssw/atualizacao", headers: await plataforma() });
    expect(plat.json()).toMatchObject({ xmlAguardando: { pendentes: 0, expirados: 0 } });
  });

  it("faixa de saúde: qualquer usuário com empresa; desligada sem integração", async () => {
    const r = await app.inject({ url: "/api/v1/ssw/saude", headers: await adminDaEmpresa() });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ configurado: false, saudavel: true });
  });
});

describe("Webhook SSW2181 (/api/public/ssw-ocorrencias)", () => {
  const URL = "/api/public/ssw-ocorrencias";
  const EVENTO = {
    cte: { numeroCTe: "123456" },
    ocorrencia: { codigo: "1", dataHoraEvento: "09-11-2026 10:30:00" },
    nf: { numeroNFe: "987" },
  };

  function cadastrarWebhook(ativa = true) {
    cenario.banco.ingestao.empresasDoWebhook.push({
      id: empresaId,
      slug: "fr",
      nome: "FR Transportes",
      status: "ativa",
      integracaoAtiva: ativa,
      parametros: {},
      segredo: cifrarSegredo(chaves, SEGREDO_WEBHOOK, contextoDoSegredo(empresaId, "ssw_webhook")),
    });
  }

  it("GET informa como enviar", async () => {
    const r = await app.inject({ url: URL });
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(r.json()).toMatchObject({ ok: true, metodo: "POST" });
  });

  it("401 sem autorização, sem gravar evento quando a empresa não é conhecida", async () => {
    cadastrarWebhook();
    const r = await app.inject({ method: "POST", url: URL, payload: EVENTO });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject([{ retorno: { codigo: 401, motivo: "autorizacao_ausente" } }]);
    expect(cenario.banco.ingestao.eventos).toEqual([]);
  });

  it("segredo na query: grava o evento autenticado e enfileira o processamento", async () => {
    cadastrarWebhook();
    const r = await app.inject({
      method: "POST",
      url: `${URL}?secret=${SEGREDO_WEBHOOK}`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(EVENTO),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject([{ retorno: { codigo: 200 } }]);
    const [evento] = cenario.banco.ingestao.eventos;
    expect(evento).toMatchObject({ empresaId, autenticado: true, statusHttp: 200 });
    expect(filas.enfileirados).toEqual([
      {
        job: "ssw_webhook",
        dados: expect.objectContaining({ empresaId, eventoId: evento?.id }) as unknown,
        deduplicar: `ssw_webhook__${evento?.id ?? ""}`,
      },
    ]);
    // O contexto da gravação é o da empresa do evento (RLS), e a busca da dona é da Plataforma.
    expect(cenario.banco.contextos).toContainEqual({
      empresaId,
      usuarioId: null,
      plataforma: false,
    });
  });

  it("sem token válido, recusa antes de ler o corpo e não guarda o conteúdo", async () => {
    cadastrarWebhook();
    const r = await app.inject({
      method: "POST",
      url: `${URL}?empresa=fr`,
      headers: { "content-type": "application/json" },
      payload: "{nao é json",
    });
    expect(r.statusCode).toBe(401);
    expect(r.json()).toMatchObject([{ retorno: { motivo: "autorizacao_ausente" } }]);
    expect(cenario.banco.ingestao.eventos).toMatchObject([
      { motivoRejeicao: "autorizacao_ausente", payloadBruto: null },
    ]);
  });

  it("IP do evento é o request.ip: cabeçalho cf-connecting-ip forjado é ignorado", async () => {
    cadastrarWebhook();
    await app.inject({
      method: "POST",
      url: `${URL}?empresa=fr&secret=errado`,
      headers: { "cf-connecting-ip": "203.0.113.9" },
      payload: EVENTO,
    });
    expect(cenario.banco.ingestao.eventos[0]?.ip).toBe("127.0.0.1");
  });

  it("limite próprio e baixo para falhas: depois dele, 429 sem gravar nada", async () => {
    cadastrarWebhook();
    const tentar = () =>
      app.inject({ method: "POST", url: `${URL}?empresa=fr&secret=errado`, payload: EVENTO });
    for (let i = 0; i < LIMITE_DE_FALHAS_POR_MINUTO; i++)
      expect((await tentar()).statusCode).toBe(401);
    expect((await tentar()).statusCode).toBe(429);
    expect(cenario.banco.ingestao.eventos).toHaveLength(LIMITE_DE_FALHAS_POR_MINUTO);
    const valido = await app.inject({
      method: "POST",
      url: `${URL}?secret=${SEGREDO_WEBHOOK}`,
      payload: EVENTO,
    });
    expect(valido.statusCode).toBe(200);
  });

  it("fila fora: 503 para o SSW reenviar, com o evento marcado", async () => {
    cadastrarWebhook();
    filas.falhar = true;
    const r = await app.inject({
      method: "POST",
      url: URL,
      headers: { authorization: `Bearer ${SEGREDO_WEBHOOK}` },
      payload: EVENTO,
    });
    expect(r.statusCode).toBe(503);
    expect(cenario.banco.ingestao.eventos[0]).toMatchObject({ statusHttp: 503 });
  });

  it("JSON inválido é recusado no formato do SSW", async () => {
    cadastrarWebhook();
    const r = await app.inject({
      method: "POST",
      url: URL,
      headers: { "content-type": "application/json", authorization: `Bearer ${SEGREDO_WEBHOOK}` },
      payload: "{nao é json",
    });
    expect(r.statusCode).toBe(400);
    expect(r.json()).toMatchObject([{ retorno: { codigo: 400 } }]);
  });
});

describe("Reprocessar webhooks rejeitados por token", () => {
  const URL = "/api/v1/admin/ssw-diagnostico/webhook/reprocessar-token-incorreto";
  const ATUAL = "n".repeat(40);
  const ANTERIOR = "a".repeat(40);
  const cifrar = (texto: string) =>
    cifrarSegredo(chaves, texto, contextoDoSegredo(empresaId, "ssw_webhook"));

  function configurarSegredos() {
    cenario.banco.ingestao.integracoes.set(`${empresaId}:ssw_webhook`, {
      ativo: true,
      parametros: {},
      segredo: cifrar(ATUAL),
      segredoAnterior: cifrar(ANTERIOR),
      temSegredo: true,
      ultimoTesteEm: null,
      ultimoTesteOk: null,
      ultimoTesteMsg: null,
      atualizadoEm: null,
    });
  }

  function recusado(tokenSha256: string[] | null) {
    const id = randomUUID();
    cenario.banco.ingestao.eventos.push({
      id,
      empresaId,
      recebidoEm: new Date("2026-11-10T10:00:00Z"),
      ip: "1.2.3.4",
      userAgent: null,
      autenticado: false,
      motivoRejeicao: "token_incorreto",
      statusHttp: 401,
      payloadBruto: { cte: { numeroCTe: "1" } },
      tokenSha256,
      erroProcessamento: null,
      cteId: null,
    });
    return id;
  }

  it("só reenvia evento cujo token é o segredo atual ou o anterior; o resto nunca vira dado", async () => {
    configurarSegredos();
    const doAtual = recusado([resumoDoSegredo("x"), resumoDoSegredo(ATUAL)]);
    const doAnterior = recusado([resumoDoSegredo(ANTERIOR)]);
    const estranho = recusado([resumoDoSegredo("token-de-quem-tenta-adivinhar")]);
    const semResumo = recusado(null);

    const r = await app.inject({ method: "POST", url: URL, headers: await plataforma() });
    expect(r.json()).toEqual({ total: 4, enfileirados: 2 });
    const enviados = filas.enfileirados.map((e) => e.dados.eventoId);
    expect(enviados.sort()).toEqual([doAtual, doAnterior].sort());
    const evento = (id: string) => cenario.banco.ingestao.eventos.find((e) => e.id === id);
    expect(evento(doAtual)?.autenticado).toBe(true);
    expect(evento(estranho)?.autenticado).toBe(false);
    expect(evento(semResumo)?.autenticado).toBe(false);

    const umSo = await app.inject({
      method: "POST",
      url: `/api/v1/admin/ingestao/webhook/eventos/${estranho}/reprocessar`,
      headers: await plataforma(),
    });
    expect(umSo.statusCode).toBe(409);
  });

  it("marca o reenvio antes de enfileirar: o worker que termina antes não fica pendente", async () => {
    configurarSegredos();
    const id = recusado([resumoDoSegredo(ATUAL)]);
    filas.aoEnfileirar = () => {
      const e = cenario.banco.ingestao.eventos.find((x) => x.id === id);
      if (e) Object.assign(e, { statusHttp: 200, erroProcessamento: null });
    };
    await app.inject({ method: "POST", url: URL, headers: await plataforma() });
    expect(cenario.banco.ingestao.eventos.find((x) => x.id === id)).toMatchObject({
      statusHttp: 200,
      erroProcessamento: null,
    });
  });

  it("recebimento guarda o SHA-256 do token, nunca o token", async () => {
    cenario.banco.ingestao.empresasDoWebhook.push({
      id: empresaId,
      slug: "fr",
      nome: "FR Transportes",
      status: "ativa",
      integracaoAtiva: true,
      parametros: {},
      segredo: cifrar(SEGREDO_WEBHOOK),
    });
    await app.inject({
      method: "POST",
      url: "/api/public/ssw-ocorrencias",
      headers: { authorization: `Bearer ${SEGREDO_WEBHOOK}` },
      payload: { cte: { numeroCTe: "1" }, ocorrencia: { codigo: "1" } },
    });
    const [evento] = cenario.banco.ingestao.eventos;
    expect(JSON.stringify(evento)).not.toContain(SEGREDO_WEBHOOK);
    expect(evento?.tokenSha256).toContain(resumoDoSegredo(SEGREDO_WEBHOOK));
  });
});
