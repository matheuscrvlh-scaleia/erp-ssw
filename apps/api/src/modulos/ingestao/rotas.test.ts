import { CABECALHO_930 } from "@erp/ingestao/relatorios";
import {
  enfileiradorFalso,
  estadoFalso,
  executarFalso,
  filaFalsa,
  travasFalsas,
} from "@erp/ingestao/testes";
import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import { segredoConfere } from "./rotas-publicas";
import { type SegredoDaIngestao, type ServicosDaIngestao } from "./servicos";

const SEGREDO = "segredo-do-ftp-de-teste";
const LINHA =
  '1;"CAP033214-5";"03/11/26";"1";"55001";"1";"12345";"";"FRT";"CAP";"04/11/26";"10:00";"04/11/26";"10:00";"usuario";"1";"ENTREGA";"";"";"";"";"";"11222333000181";"CLIENTE EXEMPLO LTDA"';
const ARQUIVO = Buffer.from([CABECALHO_930.join(";"), LINHA].join("\r\n"), "latin1").toString(
  "base64",
);

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;
let estado: ReturnType<typeof estadoFalso>;
let enfileirador: ReturnType<typeof enfileiradorFalso>;
let integracoes: string[];
let segredos: SegredoDaIngestao[];
const OUTRA = "00000000-0000-4000-8000-000000000002";
const SEGREDO_DA_OUTRA = "segredo-da-outra-empresa";

beforeEach(async () => {
  cenario = criarCenario();
  const empresa = cenario.banco.criarEmpresa();
  empresaId = empresa.id;
  estado = estadoFalso();
  enfileirador = enfileiradorFalso();
  integracoes = ["sftp"];
  segredos = [
    { empresaId, segredo: SEGREDO },
    { empresaId: OUTRA, segredo: SEGREDO_DA_OUTRA },
  ];
  const servicos: ServicosDaIngestao = {
    executarNaEmpresa: () => executarFalso(estado),
    empresasParaIngestao: () =>
      Promise.resolve([
        { id: empresaId, slug: "fr", nome: "FR", status: "ativa", integracoesAtivas: integracoes },
        { id: OUTRA, slug: "outra", nome: "Outra", status: "ativa", integracoesAtivas: ["sftp"] },
      ]),
    segredosDaIngestao: () => Promise.resolve(segredos),
    fila: filaFalsa(),
    travas: travasFalsas(),
    progressos: {
      gravar: () => Promise.resolve(),
      ler: () => Promise.resolve(null),
      limpar: () => Promise.resolve(),
    },
    enfileirador,
  };
  app = await construirAppDeTeste(cenario, null, { ingestao: servicos });
});
afterEach(() => app.close());

const importar = (headers: Record<string, string>, corpo: Record<string, unknown> = {}) =>
  app.inject({
    method: "POST",
    url: "/api/public/ftp-relatorio-import",
    headers,
    payload: { nome: "930_ocorrencias_2026-11-05_1000.csv", base64: ARQUIVO, ...corpo },
  });

describe("rotas públicas", () => {
  it("segredo comparado em tempo constante", () => {
    expect(segredoConfere("abc", "abc")).toBe(true);
    expect(segredoConfere("abcd", "abc")).toBe(false);
    expect(segredoConfere(undefined, "abc")).toBe(false);
    expect(segredoConfere("abc", null)).toBe(false);
  });

  it("ftp-relatorio-import: 401 sem segredo; 400 sem arquivo; 409 integração desligada; grava", async () => {
    expect((await importar({})).statusCode).toBe(401);
    expect((await importar({ "x-ftp-ingest-secret": "errado" })).json()).toMatchObject({
      ok: false,
      motivo: "token_invalido",
    });
    const semArquivo = await importar({ "x-ftp-ingest-secret": SEGREDO }, { base64: "" });
    expect(semArquivo.json()).toMatchObject({ motivo: "nome_ou_base64_ausentes" });
    const r = await importar({ "x-ftp-ingest-secret": SEGREDO });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      ok: true,
      status: "importado",
      relatorio: "930",
      gravados: 1,
    });
    integracoes = [];
    const desligada = await importar({ "x-ftp-ingest-secret": SEGREDO });
    expect(desligada.statusCode).toBe(409);
    expect(desligada.json()).toMatchObject({ motivo: "integracao_desligada" });
  });

  it("sem segredo, recusa antes de ler e validar o corpo (onRequest)", async () => {
    const invalido = await app.inject({
      method: "POST",
      url: "/api/public/ftp-relatorio-import",
      headers: { "content-type": "application/json" },
      payload: "{nao é json",
    });
    expect(invalido.statusCode).toBe(401);
    const foraDoSchema = await importar({}, { nome: 123 });
    expect(foraDoSchema.statusCode).toBe(401);
    const orfaos = await app.inject({
      method: "POST",
      url: "/api/public/xml-orfaos-retry",
      payload: { limite: "muitos" },
    });
    expect(orfaos.statusCode).toBe(401);
  });

  it("ssw-ciclo-aplicar aceita o token do cron e só enfileira o job", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/public/ssw-ciclo-aplicar?empresa=fr",
      headers: { "x-cron-token": SEGREDO },
      payload: {},
    });
    expect(r.json()).toMatchObject({ ok: true, status: "enfileirado" });
    expect(enfileirador.jobs).toEqual([{ nome: "ssw_ciclo_aplicar", dados: { empresaId } }]);
  });

  it("o segredo é da empresa: escolhe a empresa e não serve para pedir outra", async () => {
    const daOutra = await importar({ "x-ftp-ingest-secret": SEGREDO_DA_OUTRA }, { empresa: "fr" });
    expect(daOutra.statusCode).toBe(404);
    expect(estado.linhas).toHaveLength(0);
    const r = await app.inject({
      method: "POST",
      url: "/api/public/ssw-ciclo-aplicar",
      headers: { "x-ftp-ingest-secret": SEGREDO_DA_OUTRA },
      payload: {},
    });
    expect(r.json()).toMatchObject({ ok: true });
    expect(enfileirador.jobs).toEqual([{ nome: "ssw_ciclo_aplicar", dados: { empresaId: OUTRA } }]);
  });

  it("sem segredo cadastrado em nenhuma empresa: 503 dizendo onde cadastrar", async () => {
    segredos = [];
    const r = await importar({ "x-ftp-ingest-secret": SEGREDO });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ motivo: "ingest_secret_nao_configurado" });
  });

  it("rotas 410 do sistema antigo não existem (Q46)", async () => {
    const r = await app.inject({ method: "POST", url: "/api/public/ftp-xml-import", payload: {} });
    expect(r.statusCode).toBe(404);
  });
});

describe("telas (só Plataforma)", () => {
  it("403 para quem não é da Plataforma; Plataforma vê o pipeline e dispara o FTP", async () => {
    const usuario = cenario.banco.criarUsuario({ email: "admin@fr.com.br" });
    cenario.banco.vincular(usuario.id, empresaId, { papel: "admin" });
    const headers = await entrarComo(cenario, usuario.id, empresaId);
    const negado = await app.inject({ url: "/api/v1/admin/ingestao/pipeline", headers });
    expect(negado.statusCode).toBe(403);

    cenario.banco.plataformaAdmins.add(usuario.id);
    const r = await app.inject({ url: "/api/v1/admin/ingestao/pipeline", headers });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ ciclos: [], filaPendente: 0, aplicacaoRodando: false });

    const rodar = await app.inject({
      method: "POST",
      url: "/api/v1/admin/ingestao/ftp/rodar",
      headers,
    });
    expect(rodar.json()).toEqual({ ok: true });
    expect(enfileirador.jobs[0]).toEqual({
      nome: "ftp",
      dados: { empresaId, manual: true },
    });
  });
});
