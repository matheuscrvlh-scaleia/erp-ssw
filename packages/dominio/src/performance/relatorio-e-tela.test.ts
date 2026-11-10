import { type PontoSerie, SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/performance";
import { describe, expect, it } from "vitest";

import {
  type ContagemDosAlertas,
  janelasDosAlertas,
  limitesDosAlertas,
  montarAlertas,
} from "./alertas";
import { montarPontualidade } from "./pontualidade";
import {
  deltaPctAbs,
  deltaPP,
  derivadosDoBloco,
  impactoDosCodigos,
  montarBloco,
  statusDaUnidade,
  subtituloDoPrejuizo,
  unidadesDoRelatorio,
} from "./relatorio";
import { completarSerie, janelaDaSerie, valorDaMetrica } from "./serie";
import { calcularSlaDoCte, inicioDoSlaArquivos } from "./sla-arquivos";
import {
  configuracaoDaTela,
  ordenarCodigosDisponiveis,
  ordenarTiposDocumento,
  ordenarUnidades,
  resolverPeriodo,
  statusDoRetorno,
  statusDoSla,
  verificarParticao,
} from "./tela";

const limites = limitesDosAlertas(new Map());

function contagem(parcial: Partial<ContagemDosAlertas>): ContagemDosAlertas {
  return {
    sigla: "ARA",
    semMovimento: 0,
    nascidoAtrasado: 0,
    ocorrencia13: 0,
    ocorrencia13Multipla: 0,
    finTotalAtual: 0,
    finAtual: 0,
    finTotalBaseline: 0,
    finBaseline: 0,
    slaBaseAtual: 0,
    slaOkAtual: 0,
    slaBaseAnterior: 0,
    slaOkAnterior: 0,
    ...parcial,
  };
}

describe("alertas", () => {
  it("limites padrão e configurados", () => {
    expect(limites).toMatchObject({ vermelhoPct: 95, diasSemMovimento: 3, janelaTendenciaDias: 7 });
    expect(limitesDosAlertas(new Map([["alerta_dias_sem_movimento", "4"]])).diasSemMovimento).toBe(
      4,
    );
  });

  it("janelas: tendência de 7 dias e base de 4 semanas antes do período", () => {
    const j = janelasDosAlertas("2026-11-01", "2026-11-10", limites);
    expect(j.tendenciaAtual).toEqual({ inicio: "2026-11-04", fim: "2026-11-10" });
    expect(j.tendenciaAnterior).toEqual({ inicio: "2026-10-28", fim: "2026-11-03" });
    expect(j.baseline).toEqual({ inicio: "2026-10-04", fim: "2026-10-31" });
    expect(j.leitura).toEqual({ inicio: "2026-10-04", fim: "2026-11-10" });
  });

  it("T6: queda de SLA de 95 para 90 dispara; base anterior com 9 não", () => {
    const a = montarAlertas(
      [
        contagem({ slaBaseAtual: 20, slaOkAtual: 18, slaBaseAnterior: 20, slaOkAnterior: 19 }),
        contagem({
          sigla: "CAP",
          slaBaseAtual: 20,
          slaOkAtual: 10,
          slaBaseAnterior: 9,
          slaOkAnterior: 9,
        }),
      ],
      [],
      limites,
    );
    expect(a.quedaSla).toEqual({
      count: 1,
      items: [{ unidade: "ARA", slaAtual: 90, slaAnterior: 95, quedaPp: 5, totalAtual: 20 }],
    });
  });

  it("T7: anomalia de finalizados 20% contra 10%; base com 39 CT-e não conta", () => {
    const a = montarAlertas(
      [
        contagem({ finTotalAtual: 50, finAtual: 10, finTotalBaseline: 100, finBaseline: 10 }),
        contagem({
          sigla: "CAP",
          finTotalAtual: 50,
          finAtual: 10,
          finTotalBaseline: 39,
          finBaseline: 1,
        }),
      ],
      [],
      limites,
    );
    expect(a.finSistemaAnomalo.items).toEqual([
      { unidade: "ARA", pctAtual: 20, pctBaseline: 10, desvioPp: 10, qtdAtual: 10 },
    ]);
  });

  it("contagens, top de parceiros e de unidades", () => {
    const a = montarAlertas(
      [
        contagem({ semMovimento: 2, ocorrencia13: 3, nascidoAtrasado: 1 }),
        contagem({ sigla: "CAP", ocorrencia13: 3, ocorrencia13Multipla: 1 }),
      ],
      [
        { sigla: "ARA", parceiroId: "1", parceiroNome: "A", vencendo: 2, semAtualizacao: 1 },
        { sigla: "CAP", parceiroId: "1", parceiroNome: "A", vencendo: 1, semAtualizacao: 0 },
        { sigla: "CAP", parceiroId: "2", parceiroNome: "B", vencendo: 3, semAtualizacao: 4 },
      ],
      limites,
    );
    expect(a.semMovimento.count).toBe(2);
    expect(a.vencendo).toEqual({
      count: 6,
      topParceiros: [
        { parceiroId: "1", parceiroNome: "A", qtd: 3 },
        { parceiroId: "2", parceiroNome: "B", qtd: 3 },
      ],
    });
    expect(a.semAtualizacao.topUnidades).toEqual([
      { unidade: "CAP", qtd: 4 },
      { unidade: "ARA", qtd: 1 },
    ]);
    expect(a.ocorrencia13).toEqual({
      count: 6,
      topUnidades: [
        { unidade: "ARA", qtd: 3 },
        { unidade: "CAP", qtd: 3 },
      ],
    });
    expect(a.ocorrencia13Multipla.count).toBe(1);
    expect(a.nascidoAtrasado.topUnidades).toEqual([{ unidade: "ARA", qtd: 1 }]);
  });
});

const totaisResumo = {
  totalCtrcs: 10,
  ctrcsPenalizados: 1,
  ctrcsConcluidos: 8,
  performance: 0.957_33,
  taxaRetorno: 0.02,
  ocorrenciasPenalizantes: 2,
  ocorrenciasPendentes: 0,
  ctrcsEmAberto: 2,
  ctrcsEmAtraso: 0,
  ctrcsEmAtrasoFr: 0,
  ctrcsEmAtrasoCliente: 0,
  ctrcsSemPrazo: 0,
};

describe("relatório de período", () => {
  it("Q01: SLA Operacional e SLA Cliente do bloco em 0–100 (não mais 1,0%)", () => {
    const pont = montarPontualidade([
      {
        sigla: "ARA",
        total: 10,
        noPrazo: 6,
        foraPrazo: 2,
        semInfoBi2: 1,
        excluidoCliente: 1,
        noPrazoCliente: 1,
        foraPrazoCliente: 1,
        nascidosAvaliados: 0,
        nascidosAtraso: 0,
      },
    ]);
    const b = montarBloco(
      {
        totalCtrcs: 0,
        entregues: 7,
        finalizadoSemEntrega: 1,
        previstos: 2,
        devolvidos: 1,
        valorFreteTotal: 0,
        valorFretePerdido: 0,
      },
      totaisResumo,
      pont,
    );
    expect(b.totalCtrcs).toBe(10); // 0 nos agregados cai para o resumo
    expect(b.slaPontualidadePct).toBe(80);
    expect(b.slaClientePct).toBe(50);
    expect(b.slaOperacionalPct).toBeCloseTo(95.733);
    expect(b.taxaRetornoPct).toBe(2);
    expect(b.pctFretePerdido).toBeNull();
    expect(
      montarBloco(
        {
          totalCtrcs: 1,
          entregues: 0,
          finalizadoSemEntrega: 0,
          previstos: 1,
          devolvidos: 0,
          valorFreteTotal: 0,
          valorFretePerdido: 0,
        },
        totaisResumo,
        null,
      ),
    ).toMatchObject({ noPrazo: 0, slaPontualidadePct: null, slaClientePct: null });
  });

  it("T17: tabela por unidade junta resumo, pontualidade e produção", () => {
    const linhas = unidadesDoRelatorio(
      [
        {
          sigla: "X",
          total: 10,
          concluidos: 10,
          penalizados: 1,
          penalizadosAbertos: 0,
          performance: 0.9,
        },
      ],
      montarPontualidade([
        {
          sigla: "X",
          total: 10,
          noPrazo: 8,
          foraPrazo: 2,
          semInfoBi2: 0,
          excluidoCliente: 0,
          noPrazoCliente: 0,
          foraPrazoCliente: 0,
          nascidosAvaliados: 0,
          nascidosAtraso: 0,
        },
        {
          sigla: "Y",
          total: 5,
          noPrazo: 5,
          foraPrazo: 0,
          semInfoBi2: 0,
          excluidoCliente: 0,
          noPrazoCliente: 0,
          foraPrazoCliente: 0,
          nascidosAvaliados: 0,
          nascidosAtraso: 0,
        },
      ]).porUnidade,
      [{ sigla: "X", emitidos: 10, entregues: 7 }],
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ total: 10, entregues: 7, producaoPct: 70 });
    expect(linhas[0]?.slaOperacionalPct).toBeCloseTo(90);
    expect(linhas[0]?.slaPontualidadePct).toBeCloseTo(80);
  });

  it("impacto: ordem, filtro de códigos por texto e percentual sobre a base que sobrou", () => {
    const r = impactoDosCodigos(
      [
        { codigo: "9", descricao: null, penaliza: false, totalCtrcs: 30, totalPenalizantes: 0 },
        { codigo: "13", descricao: "x", penaliza: true, totalCtrcs: 10, totalPenalizantes: 5 },
        { codigo: "20", descricao: "y", penaliza: true, totalCtrcs: 10, totalPenalizantes: 5 },
      ],
      ["13", "9"],
    );
    expect(r.base).toBe(40);
    expect(r.linhas.map((l) => [l.codigo, l.pctDoTotal])).toEqual([
      ["13", 25],
      ["9", 75],
    ]);
  });

  it("T18: deltas", () => {
    expect(deltaPP(95.0, 95.04)).toEqual({ texto: "0,0 pp", tom: "neutral" });
    expect(deltaPP(90, 95, true)).toEqual({ texto: "▼ 5,0 pp", tom: "bad" });
    expect(deltaPP(null, 95)).toBeNull();
    expect(deltaPctAbs(5, 0)).toEqual({ texto: "▲ n/a", tom: "neutral" });
    expect(deltaPctAbs(110, 100)).toEqual({ texto: "▲ 10,0%", tom: "good" });
    expect(deltaPctAbs(110, 100, false).tom).toBe("bad");
  });

  it("derivados, prejuízo e status da unidade", () => {
    const d = derivadosDoBloco({
      ...montarBloco(
        {
          totalCtrcs: 10,
          entregues: 7,
          finalizadoSemEntrega: 1,
          previstos: 2,
          devolvidos: 0,
          valorFreteTotal: 200,
          valorFretePerdido: 50,
        },
        totaisResumo,
        null,
      ),
      noPrazo: 6,
      foraPrazo: 2,
    });
    expect(d).toMatchObject({
      totalPrazo: 8,
      pctNoPrazo: 75,
      pctPenalizadoPont: 20,
      pctProducao: 70,
    });
    expect(subtituloDoPrejuizo([])).toBe("código 13");
    expect(subtituloDoPrejuizo(["13", "20"])).toBe("códigos 13, 20");
    expect(statusDaUnidade(96, 95)).toBe("Verde");
    expect(statusDaUnidade(91, 95)).toBe("Amarelo");
    expect(statusDaUnidade(89, 95)).toBe("Vermelho");
    expect(statusDaUnidade(null, 95)).toBe("—");
  });
});

describe("série (T19)", () => {
  const ponto = (periodo: string, total: number, fora: number): PontoSerie => ({
    periodo,
    totalCtrcs: total,
    entregue: 0,
    foraTransp: 0,
    noPrazoOp: 0,
    foraPrazoOp: fora,
    noPrazoCli: 0,
    foraPrazoCli: 0,
  });

  it("período de 3 dias vira os 7 dias até o fim; 100 dias vira por mês", () => {
    expect(janelaDaSerie("2026-11-08", "2026-11-10")).toEqual({
      inicio: "2026-11-04",
      fim: "2026-11-10",
      granularidade: "dia",
      ampliada: true,
    });
    expect(janelaDaSerie("2026-08-02", "2026-11-09").granularidade).toBe("mes");
    expect(janelaDaSerie("2026-08-10", "2026-11-09").granularidade).toBe("dia");
  });

  it("eixo completo com zeros e métricas", () => {
    const s = completarSerie([ponto("2026-11-09", 10, 1)], "2026-11-04", "2026-11-10", "dia");
    expect(s).toHaveLength(7);
    expect(s[0]?.totalCtrcs).toBe(0);
    expect(valorDaMetrica("sla_op", s[5]!)).toBe(0.9);
    expect(valorDaMetrica("sla_cli", s[5]!)).toBeNull();
    expect(valorDaMetrica("volume", s[0]!)).toBe(0);
  });

  it("por mês soma os dias do mesmo mês", () => {
    const s = completarSerie(
      [ponto("2026-09-03", 1, 0), ponto("2026-09-20", 2, 1)],
      "2026-08-15",
      "2026-11-10",
      "mes",
    );
    expect(s.map((p) => [p.periodo, p.totalCtrcs])).toEqual([
      ["2026-08-01", 0],
      ["2026-09-01", 3],
      ["2026-10-01", 0],
      ["2026-11-01", 0],
    ]);
  });
});

describe("SLA pelos arquivos", () => {
  const feriados = new Set(["2026-11-02"]);
  const candidato = {
    id: "c1",
    dataPrevista: "2026-11-05",
    // 22:00 de 06/11 em Brasília (01:00Z de 07/11): conta o dia 06 de SP.
    dataEntrega: new Date("2026-11-07T01:00:00Z"),
    temPendenciaCliente: true,
    performanceDias: null,
    noPrazo: null,
    responsabilidadeCliente: null,
    fontePerformance: null,
    camposSsw: ["data_entrega_realizada"],
  };

  it("desde: 60 dias atrás, nunca antes de 01/12/2025", () => {
    expect(inicioDoSlaArquivos("2026-11-10", null)).toBe("2026-09-11");
    expect(inicioDoSlaArquivos("2026-01-10", null)).toBe("2025-12-01");
    expect(inicioDoSlaArquivos("2026-11-10", "2026-10-01")).toBe("2026-10-01");
  });

  it("atraso de 1 dia útil com pendência do cliente: fora do prazo e do cliente", () => {
    expect(calcularSlaDoCte(candidato, feriados)).toEqual({
      id: "c1",
      performanceDias: 1,
      noPrazo: false,
      responsabilidadeCliente: true,
      fontePerformance: "ssw_arquivos",
      camposSsw: [
        "data_entrega_realizada",
        "fonte_performance",
        "no_prazo",
        "performance_dias",
        "responsabilidade_cliente",
      ],
    });
  });

  it("já calculado e marcado: nada a gravar", () => {
    const pronto = {
      ...candidato,
      dataEntrega: new Date("2026-11-05T15:00:00Z"),
      performanceDias: 0,
      noPrazo: true,
      responsabilidadeCliente: false,
      fontePerformance: "ssw_arquivos",
      camposSsw: [
        "data_entrega_realizada",
        "fonte_performance",
        "no_prazo",
        "performance_dias",
        "responsabilidade_cliente",
      ],
    };
    expect(calcularSlaDoCte(pronto, feriados)).toBeNull();
  });
});

describe("regras da tela", () => {
  it("configuração com padrões", () => {
    expect(configuracaoDaTela(new Map())).toEqual({
      slaMetaPct: 95,
      slaAlertaAmareloPct: 90,
      taxaRetornoMetaPct: 3,
      otifVisivel: false,
    });
    expect(configuracaoDaTela(new Map([["otif_visivel", "true"]])).otifVisivel).toBe(true);
  });

  it("status de SLA e de retorno", () => {
    expect(statusDoSla(0.95, 0.95, 0.9)).toBe("good");
    expect(statusDoSla(0.92, 0.95, 0.9)).toBe("warn");
    expect(statusDoSla(0.8, 0.95, 0.9)).toBe("bad");
    expect(statusDoRetorno(0.05, null)).toBe("good");
    expect(statusDoRetorno(0.035, 0.03)).toBe("warn");
    expect(statusDoRetorno(0.05, 0.03)).toBe("bad");
  });

  it("períodos", () => {
    expect(resolverPeriodo("mes", "", "", "2026-11-10")).toEqual({
      inicio: "2026-11-01",
      fim: "2026-11-10",
      rotulo: "Este mês",
    });
    expect(resolverPeriodo("7d", "", "", "2026-11-10").inicio).toBe("2026-11-04");
    expect(resolverPeriodo("30d", "", "", "2026-11-10").inicio).toBe("2026-10-12");
    expect(resolverPeriodo("custom", "2026-10-01", "2026-10-05", "2026-11-10").rotulo).toBe(
      "2026-10-01 → 2026-10-05",
    );
    expect(resolverPeriodo("custom", "", "", "2026-11-10").rotulo).toBe("Este mês");
  });

  it("unidades pelo SLA Op.; sem SLA no fim", () => {
    const u = (sigla: string) => ({
      sigla,
      total: 1,
      concluidos: 1,
      penalizados: 0,
      penalizadosAbertos: 0,
      performance: 1,
    });
    const sla = new Map<string, number | null>([
      ["A", 0.9],
      ["B", 0.8],
      ["C", null],
    ]);
    expect(ordenarUnidades([u("C"), u("A"), u("B")], sla, "pior").map((l) => l.sigla)).toEqual([
      "B",
      "A",
      "C",
    ]);
    expect(ordenarUnidades([u("C"), u("A"), u("B")], sla, "melhor").map((l) => l.sigla)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("códigos por quantidade e pelo texto; tipos com CT-e primeiro", () => {
    expect(
      ordenarCodigosDisponiveis([
        { codigo: "9", descricao: null, qtd: 1 },
        { codigo: "10", descricao: null, qtd: 1 },
        { codigo: "1", descricao: null, qtd: 5 },
      ]).map((c) => c.codigo),
    ).toEqual(["1", "10", "9"]);
    expect(
      ordenarTiposDocumento(
        [
          { tipo: "NORMAL", qtd: 100 },
          { tipo: "SUBCONTRATO", qtd: 50 },
          { tipo: SEM_TIPO_DOCUMENTO, qtd: 1 },
        ],
        [
          { tipo: "SUBCONTRATO", qtd: 3 },
          { tipo: SEM_TIPO_DOCUMENTO, qtd: 5 },
        ],
      ).map((t) => [t.rotulo, t.qtd]),
    ).toEqual([
      ["sem tipo", 5],
      ["SUBCONTRATO", 3],
      ["NORMAL", 0],
    ]);
  });

  it("partição", () => {
    expect(
      verificarParticao({ totalCtrcs: 10, entregues: 7, finalizadoSistema: 1, previstos: 2 }),
    ).toEqual({ soma: 10, diferenca: 0 });
  });
});
