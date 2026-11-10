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
  it("403 para quem não é da Plataforma; leituras vêm do banco e da situação do worker-ssw", async () => {
    const admin = cenario.banco.criarUsuario({ email: "admin@fr.com.br" });
    cenario.banco.vincular(admin.id, empresaId, { papel: "admin" });
    const negado = await app.inject({
      url: `${BASE}/pipeline`,
      headers: await entrarComo(cenario, admin.id, empresaId),
    });
    expect(negado.statusCode).toBe(403);

    ciclo("2026-11-10_1000", "aberto");
    workerSsw.situacaoDaEmpresa = {
      jobs: [
        { job: "aplicar-ciclos", estado: "rodando" },
        { job: "sincronizar-ftp", estado: "rodando" },
      ],
    };
    const headers = await plataforma();
    const pipeline = await app.inject({ url: `${BASE}/pipeline`, headers });
    expect(pipeline.statusCode).toBe(200);
    expect(pipeline.json()).toMatchObject({
      ciclos: [{ cicloChave: "2026-11-10_1000", status: "aberto" }],
      aplicacaoRodando: true,
    });
    const ftp = await app.inject({ url: `${BASE}/ftp`, headers });
    expect(ftp.json()).toMatchObject({ ativo: true, travaAtiva: true, progresso: null });

    // worker-ssw fora: a tela continua com o que está no banco.
    workerSsw.fora = true;
    const semWorker = await app.inject({ url: `${BASE}/pipeline`, headers });
    expect(semWorker.statusCode).toBe(200);
    expect(semWorker.json()).toMatchObject({ aplicacaoRodando: false });
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
      {
        empresaId,
        job: "sincronizar-ftp",
        dados: { manual: true },
        deduplicar: `sincronizar-ftp__${empresaId}`,
      },
    ]);
    expect(auditadoAntes).toBe(true);

    workerSsw.naFila.add(`sincronizar-ftp__${empresaId}`);
    const repetido = await app.inject({ method: "POST", url: `${BASE}/ftp/rodar`, headers });
    expect(repetido.statusCode).toBe(200);
    expect(workerSsw.pedidos).toHaveLength(1);
  });

  it("pausar o FTP é configuração da empresa, sem o worker-ssw", async () => {
    await app.close();
    app = await construirAppDeTeste(cenario, null);
    const headers = await plataforma();
    const r = await app.inject({
      method: "POST",
      url: `${BASE}/ftp/ativo`,
      headers,
      payload: { ativo: false },
    });
    expect(r.statusCode).toBe(200);
    expect(cenario.banco.ingestao.ftpAtivo.get(empresaId)).toBe(false);
    expect(cenario.banco.auditoria.at(-1)).toMatchObject({ acao: "pausar", empresaId });
  });

  it("descartar ciclo apaga a staging e pede ao worker-ssw as projeções do Romaneio", async () => {
    ciclo("2026-11-10_1000", "aberto");
    cenario.banco.ingestao.staging.set("2026-11-10_1000", [
      {
        relatorio: "036",
        sigla: "CAP",
        numero: "33214",
        dados: { romaneio: "R1", data_emissao: "2026-11-10" },
      },
      { relatorio: "930", sigla: "CAP", numero: "33214", dados: {} },
    ]);
    const r = await app.inject({
      method: "POST",
      url: `${BASE}/ciclos/2026-11-10_1000/descartar`,
      headers: await plataforma(),
      payload: { motivo: "arquivo errado" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual({ cicloChave: "2026-11-10_1000", totalRemovido: 2 });
    expect(cenario.banco.ingestao.ciclos[0]?.status).toBe("descartado");
    expect(workerSsw.pedidos).toEqual([
      {
        empresaId,
        job: "projecoes-romaneio",
        dados: {
          chaves: [{ sigla: "CAP", numero: "33214" }],
          descartadas: [
            {
              sigla: "CAP",
              numero: "33214",
              relatorios: ["036"],
              romaneios: ["R1"],
              dias: ["2026-11-10"],
            },
          ],
        },
      },
    ]);
  });

  it("ciclo aplicado não se descarta", async () => {
    ciclo("2026-11-09_1000", "aplicado");
    const r = await app.inject({
      method: "POST",
      url: `${BASE}/ciclos/2026-11-09_1000/descartar`,
      headers: await plataforma(),
      payload: { motivo: "arquivo errado" },
    });
    expect(r.statusCode).toBe(409);
    expect(workerSsw.pedidos).toEqual([]);
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

  it("ações sem pedido no contrato do worker-ssw respondem 503 com o aviso", async () => {
    const headers = await plataforma();
    const r = await app.inject({ method: "POST", url: `${BASE}/ftp/liberar-trava`, headers });
    expect(r.statusCode).toBe(503);
    expect(r.json()).toMatchObject({ erro: { codigo: "INDISPONIVEL" } });
  });
});
