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
import { WorkerSswFalso } from "../../testes/worker-ssw-falso";
import { resumoDoSegredo } from "./casos-de-uso";

const chaves = lerChavesDeSegredo(`1:${randomBytes(32).toString("base64")}`, 1);
const TESTAR = "/api/v1/admin/ingestao/ssw-api/testar";
const DIAGNOSTICO = "/api/v1/admin/ssw-diagnostico";

let cenario: Cenario;
let app: FastifyInstance;
let workerSsw: WorkerSswFalso;
let empresaId: string;

beforeEach(async () => {
  cenario = criarCenario();
  workerSsw = new WorkerSswFalso();
  app = await construirAppDeTeste(cenario, null, { workerSsw, chavesDeSegredo: chaves });
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

  it("BI2 manual: auditado antes do pedido ao worker-ssw, na empresa ativa", async () => {
    let auditadoAntes = false;
    workerSsw.aoPedir = () => {
      auditadoAntes = cenario.banco.auditoria.some((a) => a.entidade === "bi2-0017");
    };
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/ingestao/bi2-0017/rodar",
      headers: await plataforma(),
      payload: { data: "2026-11-09" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ enfileirado: true, pendente: true, resultado: null });
    expect(workerSsw.pedidos).toEqual([
      {
        empresaId,
        job: "bi2-0017",
        dados: { modo: "manual", data: "2026-11-09", lookback: 0 },
      },
    ]);
    expect(workerSsw.consultas).toEqual([{ job: "bi2-0017", execucaoId: "1", aguardarMs: 60_000 }]);
    expect(auditadoAntes).toBe(true);
  });

  it("BI2 que falhou no worker-ssw: 409 com a mensagem dele", async () => {
    workerSsw.execucao = { estado: "falhou", erro: "O SSW não respondeu." };
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/admin/ingestao/bi2-0017/rodar",
      headers: await plataforma(),
      payload: { data: "2026-11-09" },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({
      erro: { mensagem: "O BI2 0017 falhou: O SSW não respondeu." },
    });
  });

  it("testar conexão espera o resultado do verificar-token-ssw", async () => {
    workerSsw.execucao = {
      estado: "concluida",
      resultado: {
        ok: true,
        renovado: true,
        mensagem: "Token renovado.",
        tipoFalha: null,
        tokenPrevia: "abc",
      },
    };
    const r = await app.inject({
      method: "POST",
      url: TESTAR,
      headers: await plataforma(),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ok: true, pendente: false, renovado: true });
    expect(workerSsw.pedidos[0]).toMatchObject({
      job: "verificar-token-ssw",
      dados: { manual: true },
    });
    expect(workerSsw.consultas[0]?.aguardarMs).toBe(30_000);
  });

  it("sem o worker-ssw configurado: ações 503, leituras seguem", async () => {
    await app.close();
    app = await construirAppDeTeste(cenario, null, { chavesDeSegredo: chaves });
    const headers = await plataforma();
    const acao = await app.inject({
      method: "POST",
      url: "/api/v1/admin/ingestao/bi2-0017/rodar",
      headers,
      payload: { data: "2026-11-09" },
    });
    expect(acao.statusCode).toBe(503);
    expect(acao.json()).toMatchObject({
      erro: { mensagem: "Integração com o worker do SSW não configurada." },
    });
    const leitura = await app.inject({ url: "/api/v1/admin/ingestao/bi2-0017", headers });
    expect(leitura.statusCode).toBe(200);
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
    // O token novo sai das credenciais novas: verificação forçada no worker-ssw.
    expect(workerSsw.pedidos).toEqual([
      { empresaId, job: "verificar-token-ssw", dados: { manual: true } },
    ]);

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

describe("Plataforma › Diagnóstico SSW", () => {
  it("situação dos jobs vem do worker-ssw; fora do ar, a tela avisa", async () => {
    workerSsw.situacaoDaEmpresa = {
      jobs: [
        {
          job: "sincronizar-ftp",
          estado: "rodando",
          ultimaExecucao: "2026-11-10T11:59:00.000Z",
          proximaExecucao: "2026-11-10T12:01:00.000Z",
        },
      ],
    };
    const headers = await plataforma();
    const r = await app.inject({ url: DIAGNOSTICO, headers });
    expect(r.statusCode).toBe(200);
    const corpo = r.json<{ filasDisponiveis: boolean; jobs: { job: string }[] }>();
    expect(corpo.filasDisponiveis).toBe(true);
    expect(corpo.jobs.find((j) => j.job === "sincronizar-ftp")).toMatchObject({
      agendado: true,
      ativos: 1,
      proximaExecucao: "2026-11-10T12:01:00.000Z",
    });

    workerSsw.fora = true;
    const fora = await app.inject({ url: DIAGNOSTICO, headers });
    expect(fora.statusCode).toBe(200);
    expect(fora.json()).toMatchObject({ filasDisponiveis: false });
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
      recebidoEm: new Date("2026-11-10T10:00:00Z"),
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
    const enviados = workerSsw.pedidos.map((p) => p.dados?.["eventoId"]);
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

  it("marca o reenvio antes de pedir: o worker-ssw que termina antes não fica pendente", async () => {
    configurarSegredos();
    const id = recusado([resumoDoSegredo(ATUAL)]);
    workerSsw.aoPedir = () => {
      const e = cenario.banco.ingestao.eventos.find((x) => x.id === id);
      if (e) Object.assign(e, { statusHttp: 200, erroProcessamento: null });
    };
    await app.inject({ method: "POST", url: URL, headers: await plataforma() });
    expect(cenario.banco.ingestao.eventos.find((x) => x.id === id)).toMatchObject({
      statusHttp: 200,
      erroProcessamento: null,
    });
  });
});
