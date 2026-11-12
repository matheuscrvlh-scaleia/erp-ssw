import { type CodigoDoCatalogo } from "@erp/dominio/performance/catalogo";
import { type FiltroCtrc } from "@erp/dominio/performance/filtro";
import { type ContagemDoGrupo } from "@erp/dominio/performance/resumo";
import { filtroPerformance } from "@erp/shared/contratos/performance";
import { describe, expect, it } from "vitest";

import { criarPerformanceFalsa } from "../../testes/leituras-falsas";
import { type Executor } from "../repositorios";
import { type ContextoDaConsulta } from "./consultas";
import {
  exportarTela,
  LIMITE_DA_EXPORTACAO,
  obterAlertas,
  obterOtif,
  obterPrevistos,
  obterRelatorio,
  obterResumo,
  obterSerie,
  type RepositorioPerformance,
} from "./performance.service";

const ctx = { empresaId: "e1", fuso: "America/Sao_Paulo" };
// 22:30 de 10/11 em Brasília: em UTC já é dia 11.
const agora = new Date("2026-11-11T01:30:00Z");
const entrada = filtroPerformance.parse({ inicio: "2026-11-01", fim: "2026-11-10" });

function executor(repo: RepositorioPerformance): Executor<"performance"> {
  return (fn) => fn({ performance: repo });
}

function grupo(parcial: Partial<ContagemDoGrupo>): ContagemDoGrupo {
  return {
    sigla: "ARA",
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
    freteRomaneado: "0",
    fretePerdido: "0",
    ...parcial,
  };
}

const catalogo: CodigoDoCatalogo[] = [
  {
    codigo: 13,
    descricao: "Entrega prejudicada",
    tipoSsw: "PENDENCIA_TRANSPORTADORA",
    penaliza: true,
    responsavel: "FR",
    pendenteClassificacao: false,
    pendenciaAcompanhada: true,
  },
  {
    codigo: 12,
    descricao: "Devolução",
    tipoSsw: "BAIXA",
    penaliza: false,
    responsavel: "sistema",
    pendenteClassificacao: false,
    pendenciaAcompanhada: false,
  },
];

describe("obterResumo", () => {
  it("normaliza o filtro, usa o hoje do fuso da empresa e monta cards, unidades e produção", async () => {
    const vistos: {
      filtro: FiltroCtrc;
      consulta: ContextoDaConsulta;
      prejuizo: readonly number[];
    }[] = [];
    const repo: RepositorioPerformance = {
      ...criarPerformanceFalsa(),
      filiaisProprias: () => Promise.resolve(["ARA"]),
      catalogo: () => Promise.resolve(catalogo),
      contagensPorGrupo: (consulta, filtro, _conjuntos, prejuizo) => {
        vistos.push({ consulta, filtro, prejuizo });
        return Promise.resolve([
          grupo({
            unidadeId: "u1",
            total: 4,
            entregues: 3,
            concluidos: 3,
            abertos: 1,
            penalizadosConcluidos: 1,
            freteRomaneado: "200.50",
          }),
        ]);
      },
      metasDeRetorno: () => Promise.resolve([{ unidadeId: "u1", valor: 0.03 }]),
    };
    const r = await obterResumo(
      executor(repo),
      ctx,
      { ...entrada, unidades: ["ara"], codigos: ["13"] },
      agora,
    );
    expect(vistos[0]?.consulta.hoje).toBe("2026-11-10");
    expect(vistos[0]?.filtro.filiais).toEqual(["ARA"]);
    expect(vistos[0]?.prejuizo).toEqual([13]);
    expect(r.periodo).toEqual({ inicio: "2026-11-01", fim: "2026-11-10", dias: 10 });
    expect(r.totais.totalCtrcs).toBe(4);
    expect(r.metaTaxaRetorno).toBeCloseTo(0.03);
    expect(r.porUnidade).toHaveLength(1);
    expect(r.producao).toMatchObject({ entregues: 3, previstos: 1, valorFreteTotal: 200.5 });
  });
});

describe("obterPrevistos", () => {
  it("sempre por emissão; 'todos em aberto' tira o período; faixa pelo dia de Brasília", async () => {
    const filtros: FiltroCtrc[] = [];
    const repo: RepositorioPerformance = {
      ...criarPerformanceFalsa(),
      previstos: (_c, filtro) => {
        filtros.push(filtro);
        return Promise.resolve([
          { codigo: 85, prevista: "2026-11-11", qtd: 1, peso: "1", volumes: 1, frete: "1" },
        ]);
      },
    };
    const r = await obterPrevistos(
      executor(repo),
      ctx,
      { ...entrada, baseData: "prevista", ignorarPeriodo: true },
      agora,
    );
    expect(filtros[0]?.periodo).toBeNull();
    expect(filtros[0]?.baseData).toBe("emissao");
    expect(r.faixa).toEqual([{ key: "d1", qtd: 1, peso: 1, volumes: 1, frete: 1 }]);
  });
});

describe("obterAlertas", () => {
  it("T9: vencendo até o dia de agora + 48 h no fuso da empresa; janelas pelo período", async () => {
    let limite = "";
    let leitura = "";
    const repo: RepositorioPerformance = {
      ...criarPerformanceFalsa(),
      alertasPorEmissao: (_c, _f, janelas) => {
        leitura = janelas.leitura.inicio;
        return Promise.resolve([]);
      },
      alertasEmAberto: (_c, _f, _l, _k, limiteDeVencimento) => {
        limite = limiteDeVencimento;
        return Promise.resolve([]);
      },
    };
    const r = await obterAlertas(
      executor(repo),
      ctx,
      entrada,
      new Date("2026-11-11T01:00:00Z"), // 22:00 de 10/11 em SP
    );
    expect(limite).toBe("2026-11-12");
    expect(leitura).toBe("2026-10-04");
    expect(r.limites.janelaVencimentoH).toBe(48);
  });
});

describe("obterOtif", () => {
  it("desligado na empresa: nulo, sem consultar", async () => {
    const repo = criarPerformanceFalsa();
    expect(await obterOtif(executor(repo), ctx, entrada, agora)).toBeNull();
  });

  it("ligado: percentual com 4 casas", async () => {
    const repo: RepositorioPerformance = {
      ...criarPerformanceFalsa(),
      configuracoes: () => Promise.resolve(new Map([["otif_visivel", "true"]])),
      otif: () => Promise.resolve({ total: 3, problemas: 2 }),
    };
    expect(await obterOtif(executor(repo), ctx, entrada, agora)).toEqual({
      total: 3,
      problemas: 2,
      pct: 0.6667,
    });
  });
});

describe("obterSerie", () => {
  it("completa o eixo com zeros", async () => {
    const repo: RepositorioPerformance = {
      ...criarPerformanceFalsa(),
      serie: () =>
        Promise.resolve([
          {
            periodo: "2026-11-03",
            totalCtrcs: 5,
            entregue: 0,
            foraTransp: 0,
            noPrazoOp: 0,
            foraPrazoOp: 0,
            noPrazoCli: 0,
            foraPrazoCli: 0,
          },
        ]),
    };
    const s = await obterSerie(executor(repo), ctx, { ...entrada, granularidade: "dia" }, agora);
    expect(s).toHaveLength(10);
    expect(s[2]).toMatchObject({ periodo: "2026-11-03", totalCtrcs: 5 });
  });
});

describe("obterRelatorio", () => {
  it("foto do período e do comparativo, com SLA em 0–100 (Q01) e limites da configuração", async () => {
    const periodos: string[] = [];
    const repo: RepositorioPerformance = {
      ...criarPerformanceFalsa(),
      configuracoes: () => Promise.resolve(new Map([["sla_meta_pct", "96"]])),
      catalogo: () => Promise.resolve(catalogo),
      contagensPorGrupo: (_c, filtro) => {
        periodos.push(filtro.periodo?.inicio ?? "");
        return Promise.resolve([grupo({ total: 10, concluidos: 10, entregues: 10 })]);
      },
      pontualidade: () =>
        Promise.resolve([
          {
            sigla: "ARA",
            total: 10,
            noPrazo: 9,
            foraPrazo: 1,
            semInfoBi2: 0,
            excluidoCliente: 0,
            noPrazoCliente: 0,
            foraPrazoCliente: 0,
            nascidosAvaliados: 0,
            nascidosAtraso: 0,
          },
        ]),
      impacto: () =>
        Promise.resolve([
          { codigo: "13", totalCtrcs: 4, totalPenalizantes: 2 },
          { codigo: "A1", totalCtrcs: 1, totalPenalizantes: 0 },
          { codigo: null, totalCtrcs: 5, totalPenalizantes: 0 },
        ]),
      finalizadosPorCodigo: () => Promise.resolve([{ codigo: 12, qtd: 2 }]),
    };
    const r = await obterRelatorio(
      executor(repo),
      ctx,
      { ...entrada, comparativoInicio: "2026-10-01", comparativoFim: "2026-10-10" },
      agora,
    );
    expect(periodos).toEqual(["2026-11-01", "2026-10-01"]);
    expect(r.atual.slaPontualidadePct).toBe(90);
    expect(r.limites).toEqual({ slaMetaPct: 96, taxaRetornoMetaPct: 3 });
    expect(r.impactoCodigos).toEqual([
      {
        codigo: "13",
        descricao: "Entrega prejudicada",
        penaliza: true,
        totalCtrcs: 4,
        totalPenalizantes: 2,
        pctDoTotal: 100,
      },
    ]);
    expect(r.impactoTotalPeriodo).toBe(10);
    expect(r.finalizadoPorCodigo).toEqual([{ codigo: 12, descricao: "Devolução", qtd: 2 }]);
    expect(r.comparativo?.periodo).toEqual({ inicio: "2026-10-01", fim: "2026-10-10" });
  });
});

describe("exportarTela", () => {
  const cte = (id: string) => ({
    id,
    numeroNf: 10,
    numero: "123",
    sigla: "ARA",
    dataEmissao: "2026-11-05",
    filial: "ARA",
    remetente: null,
    destinatario: null,
    cidadeDestino: "Campinas",
    ufDestino: "SP",
    peso: "10.500",
    volumes: 1,
    valorFrete: "99.90",
    placaColeta: null,
    placaEntrega: null,
    siglaCte: "CT",
    numeroCte: 55,
    statusAtual: null,
  });

  it("uma linha por ocorrência; CT-e sem ocorrência sai uma vez; avisa o corte", async () => {
    const repo: RepositorioPerformance = {
      ...criarPerformanceFalsa(),
      ctesParaExportar: (_c, _f, limite) =>
        Promise.resolve(Array.from({ length: limite }, (_, i) => cte(`c${i}`))),
      ocorrenciasDosCtes: () =>
        Promise.resolve([
          { cteId: "c0", codigo: 85, descricao: "Saída", dataHora: "2026-11-05T12:00:00.000Z" },
          { cteId: "c0", codigo: 1, descricao: "Entrega", dataHora: "2026-11-06T12:00:00.000Z" },
        ]),
    };
    const r = await exportarTela(executor(repo), ctx, entrada, agora);
    expect(r.truncado).toBe(true);
    expect(r.linhas).toHaveLength(LIMITE_DA_EXPORTACAO + 1);
    expect(r.linhas[0]).toMatchObject({
      codigo: 85,
      cidadeDestino: "Campinas/SP",
      peso: 10.5,
      valorFrete: 99.9,
      cteVinculo: "CT55",
    });
    expect(r.linhas[2]).toMatchObject({ codigo: null, dataHora: null });
  });
});
