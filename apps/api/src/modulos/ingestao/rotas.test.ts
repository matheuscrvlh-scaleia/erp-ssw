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
import { type ServicosDaIngestao } from "./servicos";

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

beforeEach(async () => {
  cenario = criarCenario();
  const empresa = cenario.banco.criarEmpresa();
  empresaId = empresa.id;
  estado = estadoFalso();
  enfileirador = enfileiradorFalso();
  integracoes = ["sftp"];
  const servicos: ServicosDaIngestao = {
    executarNaEmpresa: () => executarFalso(estado),
    empresasParaIngestao: () =>
      Promise.resolve([
        { id: empresaId, slug: "fr", nome: "FR", status: "ativa", integracoesAtivas: integracoes },
      ]),
    tokenDoCron: () => Promise.resolve("token-do-cron-de-teste"),
    fila: filaFalsa(),
    travas: travasFalsas(),
    progressos: {
      gravar: () => Promise.resolve(),
      ler: () => Promise.resolve(null),
      limpar: () => Promise.resolve(),
    },
    enfileirador,
    segredoDoFtp: SEGREDO,
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

  it("ssw-ciclo-aplicar aceita o token do cron e só enfileira o job", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/public/ssw-ciclo-aplicar?empresa=fr",
      headers: { "x-cron-token": "token-do-cron-de-teste" },
      payload: {},
    });
    expect(r.json()).toMatchObject({ ok: true, status: "enfileirado" });
    expect(enfileirador.jobs).toEqual([{ nome: "aplicar-ciclos", dados: { empresaId } }]);
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
      nome: "sincronizar-ftp",
      dados: { empresaId, manual: true },
    });
  });
});
