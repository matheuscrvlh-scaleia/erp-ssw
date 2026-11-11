import { EXEMPLOS } from "@erp/shared/contratos/worker-ssw";
import { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type Cenario, construirAppDeTeste, criarCenario, entrarComo } from "../../testes/cenario";
import { WorkerSswFalso } from "../../testes/worker-ssw-falso";

const BASE = "/api/v1/admin/ingestao";

let cenario: Cenario;
let app: FastifyInstance;
let empresaId: string;
let workerSsw: WorkerSswFalso;

beforeEach(async () => {
  cenario = criarCenario();
  empresaId = cenario.banco.criarEmpresa().id;
  workerSsw = new WorkerSswFalso();
  app = await construirAppDeTeste(cenario, null, { workerSsw });
});
afterEach(() => app.close());

async function plataforma() {
  const u = cenario.banco.criarUsuario({ email: "plataforma@scale.com.br" });
  cenario.banco.plataformaAdmins.add(u.id);
  return entrarComo(cenario, u.id, empresaId);
}

function ciclo(cicloChave: string, status: string) {
  const instante = new Date("2026-11-10T10:00:00Z");
  cenario.banco.ingestao.ciclos.push({
    empresaId,
    cicloChave,
    status,
    motivo: null,
    faltantes: [],
    totais: {},
    arquivosImportados: 1,
    linhasImportadas: 2,
    primeiroArquivoEm: instante,
    ultimoArquivoEm: instante,
    fechadoEm: null,
    aplicadoEm: status === "aplicado" ? instante : null,
  });
}

describe("telas de ingestão (só Plataforma)", () => {
  it("403 para quem não é da Plataforma; pipeline vem do banco e da situação do worker-ssw", async () => {
    const admin = cenario.banco.criarUsuario({ email: "admin@fr.com.br" });
    cenario.banco.vincular(admin.id, empresaId, { papel: "admin" });
    const negado = await app.inject({
      url: `${BASE}/pipeline`,
      headers: await entrarComo(cenario, admin.id, empresaId),
    });
    expect(negado.statusCode).toBe(403);

    ciclo("2026-11-10_1000", "aberto");
    workerSsw.situacaoDaEmpresa = {
      jobs: [],
      aplicacao: { pendentes: 42, rodando: true },
    };
    const headers = await plataforma();
    const pipeline = await app.inject({ url: `${BASE}/pipeline`, headers });
    expect(pipeline.statusCode).toBe(200);
    expect(pipeline.json()).toMatchObject({
      ciclos: [{ cicloChave: "2026-11-10_1000", status: "aberto" }],
      filaPendente: 42,
      aplicacaoRodando: true,
    });

    // worker-ssw fora: a tela continua com o que está no banco.
    workerSsw.fora = true;
    const semWorker = await app.inject({ url: `${BASE}/pipeline`, headers });
    expect(semWorker.statusCode).toBe(200);
    expect(semWorker.json()).toMatchObject({ filaPendente: 0, aplicacaoRodando: false });
  });

  it("FTP: estado do worker-ssw com o histórico do banco; fora do ar, a pausa do banco", async () => {
    workerSsw.respostas.ftp = EXEMPLOS.ftp;
    const headers = await plataforma();
    const ftp = await app.inject({ url: `${BASE}/ftp`, headers });
    expect(ftp.statusCode).toBe(200);
    expect(ftp.json()).toEqual({ ...EXEMPLOS.ftp, historico: [] });

    workerSsw.fora = true;
    cenario.banco.ingestao.ftpAtivo.set(empresaId, false);
    const fora = await app.inject({ url: `${BASE}/ftp`, headers });
    expect(fora.json()).toMatchObject({ ativo: false, travaAtiva: false, progresso: null });
  });

  it("rodar o FTP: auditoria gravada antes do pedido; repetido na fila é descartado", async () => {
    let auditadoAntes = false;
    workerSsw.aoPedir = () => {
      auditadoAntes = cenario.banco.auditoria.some((a) => a.resumo?.includes("FTP disparada"));
    };
    const headers = await plataforma();
    const r = await app.inject({ method: "POST", url: `${BASE}/ftp/rodar`, headers });
    expect(r.statusCode).toBe(200);
    expect(workerSsw.pedidos).toEqual([
      { empresaId, job: "sincronizar-ftp", dados: { manual: true }, deduplicar: true },
    ]);
    expect(auditadoAntes).toBe(true);

    workerSsw.naFila.add("sincronizar-ftp");
    const repetido = await app.inject({ method: "POST", url: `${BASE}/ftp/rodar`, headers });
    expect(repetido.statusCode).toBe(200);
    expect(workerSsw.pedidos).toHaveLength(1);
  });

  it("pausar e liberar a trava do FTP passam pelo worker-ssw, auditados antes", async () => {
    workerSsw.respostas.pausarFtp = EXEMPLOS.ok;
    workerSsw.respostas.liberarTravaFtp = EXEMPLOS.ok;
    let auditadoAntes = false;
    workerSsw.aoOperar = (operacao) => {
      if (operacao === "pausarFtp") {
        auditadoAntes = cenario.banco.auditoria.some((a) => a.acao === "pausar");
      }
    };
    const headers = await plataforma();
    const pausa = await app.inject({
      method: "POST",
      url: `${BASE}/ftp/ativo`,
      headers,
      payload: { ativo: false },
    });
    expect(pausa.statusCode).toBe(200);
    expect(auditadoAntes).toBe(true);
    expect(cenario.banco.auditoria.at(-1)).toMatchObject({ acao: "pausar", empresaId });
    const trava = await app.inject({ method: "POST", url: `${BASE}/ftp/liberar-trava`, headers });
    expect(trava.statusCode).toBe(200);
    expect(workerSsw.operacoes).toEqual([
      { empresaId, operacao: "pausarFtp", corpo: { ativo: false } },
      { empresaId, operacao: "liberarTravaFtp" },
    ]);
  });

  it("retomar e descartar ciclo: o worker-ssw decide e responde no formato da tela", async () => {
    workerSsw.respostas.retomarCiclo = EXEMPLOS.cicloRetomado;
    workerSsw.respostas.descartarCiclo = EXEMPLOS.cicloDescartado;
    const headers = await plataforma();
    const retomar = await app.inject({
      method: "POST",
      url: `${BASE}/ciclos/2026-11-10_1000/retomar`,
      headers,
    });
    expect(retomar.json()).toEqual(EXEMPLOS.cicloRetomado);
    const descartar = await app.inject({
      method: "POST",
      url: `${BASE}/ciclos/2026-11-10_1000/descartar`,
      headers,
      payload: { motivo: "arquivo errado" },
    });
    expect(descartar.json()).toEqual(EXEMPLOS.cicloDescartado);
    expect(workerSsw.operacoes).toEqual([
      { empresaId, operacao: "retomarCiclo", parametros: { chave: "2026-11-10_1000" } },
      {
        empresaId,
        operacao: "descartarCiclo",
        parametros: { chave: "2026-11-10_1000" },
        corpo: { motivo: "arquivo errado" },
      },
    ]);
    expect(cenario.banco.auditoria.at(-1)).toMatchObject({
      acao: "descartar",
      entidade: "ingestao_ciclos",
      entidadeId: "2026-11-10_1000",
    });
  });

  it("descartar sem motivo é recusado pela tela, sem chamar o worker-ssw", async () => {
    const r = await app.inject({
      method: "POST",
      url: `${BASE}/ciclos/2026-11-10_1000/descartar`,
      headers: await plataforma(),
      payload: { motivo: "" },
    });
    expect(r.statusCode).toBe(422);
    expect(workerSsw.operacoes).toEqual([]);
  });

  it("importar relatório e XML e aplicar: corpo da tela traduzido para o do worker-ssw", async () => {
    workerSsw.respostas.importarRelatorio = EXEMPLOS.relatorioImportado;
    workerSsw.respostas.aplicar = EXEMPLOS.resultadoDaAplicacao;
    workerSsw.respostas.importarXml = EXEMPLOS.resultadoDoXml;
    const headers = await plataforma();
    const relatorio = await app.inject({
      method: "POST",
      url: `${BASE}/relatorios`,
      headers,
      payload: { relatorio: "930", conteudo: "CTRC;OCORRÊNCIA\n", nome: "930.csv" },
    });
    expect(relatorio.json()).toEqual(EXEMPLOS.relatorioImportado);
    const aplicar = await app.inject({
      method: "POST",
      url: `${BASE}/aplicar`,
      headers,
      payload: { dryRun: true },
    });
    expect(aplicar.json()).toEqual(EXEMPLOS.resultadoDaAplicacao);
    const xml = await app.inject({
      method: "POST",
      url: `${BASE}/xml`,
      headers,
      payload: { nome: "ctes.zip", base64: EXEMPLOS.xml.conteudoBase64 },
    });
    expect(xml.json()).toEqual(EXEMPLOS.resultadoDoXml);

    expect(workerSsw.operacoes.map((o) => [o.operacao, o.corpo])).toEqual([
      [
        "importarRelatorio",
        {
          relatorio: "930",
          nomeArquivo: "930.csv",
          conteudoBase64: Buffer.from("CTRC;OCORRÊNCIA\n", "utf8").toString("base64"),
          aceitarDivergencia: false,
        },
      ],
      ["aplicar", { simular: true, limite: 4000, offset: 0 }],
      ["importarXml", EXEMPLOS.xml],
    ]);
    expect(cenario.banco.auditoria.map((a) => a.acao)).toEqual(["importar", "simular", "importar"]);
  });

  it("reprocessar órfãos espera o resultado do worker-ssw", async () => {
    workerSsw.execucao = {
      estado: "concluida",
      resultado: { expirados: 1, tentados: 5, casados: 3 },
    };
    const r = await app.inject({
      method: "POST",
      url: `${BASE}/xml/orfaos`,
      headers: await plataforma(),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ expirados: 1, tentados: 5, casados: 3 });
    expect(workerSsw.pedidos[0]).toMatchObject({ job: "reprocessar-xml-orfaos" });
  });

  it("sem o worker-ssw configurado: ações 503 (sem auditoria), leituras seguem", async () => {
    await app.close();
    app = await construirAppDeTeste(cenario, null);
    const headers = await plataforma();
    const r = await app.inject({ method: "POST", url: `${BASE}/ftp/liberar-trava`, headers });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({
      erro: {
        mensagem:
          "Integração com o worker do SSW não configurada. Configure em Plataforma › Integrações.",
      },
    });
    expect(cenario.banco.auditoria).toEqual([]);
    const ftp = await app.inject({ url: `${BASE}/ftp`, headers });
    expect(ftp.statusCode).toBe(200);
  });
});
