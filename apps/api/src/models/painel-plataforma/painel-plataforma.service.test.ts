import { type ContagemPontualidade } from "@erp/dominio/performance/pontualidade";
import { type ContagemDoGrupo } from "@erp/dominio/performance/resumo";
import { type PainelPlataforma } from "@erp/shared/contratos/painel-plataforma";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cenarioDeAdmin } from "../../testes/admin";
import { BancoEmMemoria } from "../../testes/banco-em-memoria";
import { WorkerSswFalso } from "../../testes/worker-ssw-falso";
import {
  criarCacheDoPainel,
  type NaEmpresa,
  obterPainel,
  type PainelMontado,
} from "./painel-plataforma.service";

const AGORA = new Date("2026-11-12T15:00:00Z");
const MINUTO = 60_000;

function grupo(parcial: Partial<ContagemDoGrupo>): ContagemDoGrupo {
  return {
    sigla: "CPS",
    unidadeId: null,
    total: 0,
    entregues: 0,
    finalizados: 0,
    concluidos: 0,
    abertos: 0,
    penalizados: 0,
    penalizadosConcluidos: 0,
    penalizadosAbertos: 0,
    retornos: 0,
    retornosConcluidos: 0,
    ocorrenciasPenalizantes: 0,
    ocorrenciasPendentes: 0,
    emAtraso: 0,
    emAtrasoCliente: 0,
    semPrazo: 0,
    freteRomaneado: null,
    fretePerdido: null,
    ...parcial,
  };
}

function pontualidade(total: number, foraPrazo: number): ContagemPontualidade {
  return {
    sigla: "CPS",
    total,
    noPrazo: total - foraPrazo,
    foraPrazo,
    semInfoBi2: 0,
    excluidoCliente: 0,
    noPrazoCliente: 0,
    foraPrazoCliente: 0,
    nascidosAvaliados: 0,
    nascidosAtraso: 0,
  };
}

let banco: BancoEmMemoria;
let worker: WorkerSswFalso;
const naEmpresa: NaEmpresa = (empresaId) => (fn) =>
  banco.executar({ empresaId, usuarioId: null, plataforma: true }, fn);

function montar(aoFalhar = vi.fn()) {
  return obterPainel(naEmpresa, { workerSsw: worker, agora: () => AGORA, aoFalhar });
}

beforeEach(() => {
  banco = new BancoEmMemoria();
  worker = new WorkerSswFalso();
  banco.ingestao.ultimaAplicacao = new Date(AGORA.getTime() - 30 * MINUTO);
});

describe("obterPainel", () => {
  it("junta números da Performance e saúde por empresa, com os totais de todas", async () => {
    const fr = banco.criarEmpresa({ nome: "FR Transportes" });
    const outra = banco.criarEmpresa({ nome: "Outra", corPrimaria: "#0a7f3f" });
    const ativo = banco.criarUsuario({ email: "a@fr.com.br", ultimoLoginEm: AGORA });
    banco.vincular(ativo.id, fr.id);
    banco.vincular(ativo.id, outra.id);
    banco.performance.contagensPorGrupo = (ctx) =>
      Promise.resolve(
        ctx.empresaId === fr.id
          ? [grupo({ total: 100, entregues: 80, abertos: 15, emAtraso: 5 })]
          : [grupo({ total: 50, entregues: 30, abertos: 20, emAtraso: 12 })],
      );
    banco.performance.pontualidade = (ctx) =>
      Promise.resolve([ctx.empresaId === fr.id ? pontualidade(100, 4) : pontualidade(50, 10)]);
    banco.performance.configuracoes = () => Promise.resolve(new Map([["sla_meta_pct", "95"]]));

    const painel = await montar();

    expect(painel.periodo).toEqual({ inicio: "2026-11-01", fim: "2026-11-12" });
    const linhaFr = painel.empresas.find((e) => e.id === fr.id);
    expect(linhaFr?.numeros).toEqual({
      ctesNoMes: 100,
      entreguesNoMes: 80,
      emAberto: 15,
      emAtraso: 5,
      slaOperacional: 0.96,
      slaMeta: 0.95,
      situacaoDoSla: "bom",
    });
    expect(painel.empresas.find((e) => e.id === outra.id)?.numeros?.situacaoDoSla).toBe("ruim");
    expect(linhaFr).toMatchObject({
      usuariosAtivos: 1,
      ultimoLoginEm: AGORA,
      saude: { nivel: "ok", motivos: [] },
      workerSsw: { situacao: "ok", jobsComFalha: [] },
    });
    expect(painel.totais).toEqual({
      empresas: 2,
      porNivel: { ok: 2, atencao: 0, critico: 0, inativa: 0 },
      usuariosAtivos: 2,
      ctesNoMes: 150,
      entreguesNoMes: 110,
      emAtraso: 17,
      // Mesma regra da Performance sobre as contagens somadas: (150 − 14) ÷ 150.
      slaOperacional: 0.9067,
    });
  });

  it("lê os dados de cada empresa no contexto dela (RLS) e o resto sem empresa", async () => {
    const fr = banco.criarEmpresa();
    await montar();
    expect(banco.contextos).toContainEqual({ empresaId: null, usuarioId: null, plataforma: true });
    expect(banco.contextos).toContainEqual({ empresaId: fr.id, usuarioId: null, plataforma: true });
  });

  it("empresa cujos números falham segue na lista, sem números e em atenção", async () => {
    const fr = banco.criarEmpresa();
    const usuario = banco.criarUsuario({ email: "a@fr.com.br", ultimoLoginEm: AGORA });
    banco.vincular(usuario.id, fr.id);
    const erro = new Error("statement timeout");
    banco.performance.contagensPorGrupo = () => Promise.reject(erro);
    const aoFalhar = vi.fn();

    const painel = await montar(aoFalhar);

    expect(aoFalhar).toHaveBeenCalledWith(erro, fr.id);
    expect(painel.empresas[0]).toMatchObject({
      numeros: null,
      saude: { nivel: "atencao", motivos: ["Números do mês indisponíveis"] },
    });
    expect(painel.totais).toMatchObject({ ctesNoMes: 0, slaOperacional: null });
  });

  it("acusa SSW API quebrada, job do worker com falha e põe as críticas primeiro", async () => {
    const usuario = banco.criarUsuario({ email: "a@fr.com.br", ultimoLoginEm: AGORA });
    const boa = banco.criarEmpresa({ nome: "A boa" });
    const quebrada = banco.criarEmpresa({ nome: "Z quebrada" });
    for (const e of [boa, quebrada]) banco.vincular(usuario.id, e.id);
    banco.ingestao.integracoes.set(`${quebrada.id}:ssw_api`, {
      ativo: true,
      parametros: {},
      temSegredo: false,
      segredo: null,
      segredoAnterior: null,
      ultimoTesteEm: null,
      ultimoTesteOk: null,
      ultimoTesteMsg: null,
      atualizadoEm: null,
    });
    worker.situacaoDaEmpresa = {
      jobs: [
        {
          job: "sincronizar-ftp",
          estado: "falhou",
          ultimaExecucao: {
            execucaoId: "1",
            estado: "falhou",
            terminadaEm: AGORA.toISOString(),
            erro: "FTP recusou",
          },
          agendado: true,
          naFila: 0,
          rodando: 0,
          atrasados: 0,
          falhos: 1,
          ultimasFalhas: [],
        },
      ],
      aplicacao: { pendentes: 0, rodando: false },
    };

    const painel = await montar();

    expect(painel.empresas.map((e) => [e.nome, e.saude.nivel])).toEqual([
      ["Z quebrada", "critico"],
      ["A boa", "atencao"],
    ]);
    expect(painel.empresas[0]?.saude.motivos).toEqual([
      "SSW API sem credenciais",
      "Falha recente: sincronizar-ftp",
    ]);
    expect(painel.empresas[0]?.ssw).toMatchObject({ saudavel: false, motivo: "sem_credenciais" });
  });

  it("worker-ssw fora não derruba o painel", async () => {
    banco.criarEmpresa();
    worker.fora = true;
    const painel = await montar();
    expect(painel.empresas[0]?.workerSsw.situacao).toBe("fora");
    expect(painel.empresas[0]?.saude.motivos).toContain("worker-ssw não respondeu");
  });
});

describe("criarCacheDoPainel", () => {
  const painel: PainelMontado = {
    geradoEm: AGORA,
    periodo: { inicio: "2026-11-01", fim: "2026-11-12" },
    totais: {
      empresas: 0,
      porNivel: { ok: 0, atencao: 0, critico: 0, inativa: 0 },
      usuariosAtivos: 0,
      ctesNoMes: 0,
      entreguesNoMes: 0,
      emAtraso: 0,
      slaOperacional: null,
    },
    empresas: [],
  };

  it("reaproveita o painel por 60 s e monta de novo depois", async () => {
    let agora = AGORA;
    const doCache = criarCacheDoPainel(() => agora);
    const montarPainel = vi.fn(() => Promise.resolve(painel));
    await doCache(montarPainel);
    agora = new Date(AGORA.getTime() + 59_000);
    await doCache(montarPainel);
    expect(montarPainel).toHaveBeenCalledTimes(1);
    agora = new Date(AGORA.getTime() + 61_000);
    await doCache(montarPainel);
    expect(montarPainel).toHaveBeenCalledTimes(2);
  });

  it("não guarda falha: o próximo pedido tenta de novo", async () => {
    const doCache = criarCacheDoPainel(() => AGORA);
    await expect(doCache(() => Promise.reject(new Error("fora")))).rejects.toThrow("fora");
    await expect(doCache(() => Promise.resolve(painel))).resolves.toBe(painel);
  });
});

describe("GET /api/v1/plataforma/painel", () => {
  let t: Awaited<ReturnType<typeof cenarioDeAdmin>>;
  beforeEach(async () => {
    t = await cenarioDeAdmin();
  });
  afterEach(() => t.app.close());

  it("só a Plataforma vê; ela recebe uma linha por empresa", async () => {
    const url = "/api/v1/plataforma/painel";
    expect((await t.app.inject({ method: "GET", url })).statusCode).toBe(401);
    const { headers: deAdmin } = await t.comoPapel("super_admin");
    expect((await t.app.inject({ method: "GET", url, headers: deAdmin })).statusCode).toBe(403);
    const { headers } = await t.comoPlataforma();
    const r = await t.app.inject({ method: "GET", url, headers });
    expect(r.statusCode).toBe(200);
    expect(
      r
        .json<PainelPlataforma>()
        .empresas.map((e) => e.nome)
        .sort(),
    ).toEqual(["FR Transportes", "Outra Transportadora"]);
  });
});
