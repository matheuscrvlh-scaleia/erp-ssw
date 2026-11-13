import { type PontoSerie } from "@erp/shared/contracts/performance";
import { describe, expect, it } from "vitest";

import { exportacaoDaSerie } from "./SeriesChart";

// origem: colunasExport (SlaSerieChart.tsx, sistema atual)

describe("exportação do gráfico mês a mês", () => {
  const ponto: PontoSerie = {
    periodo: "2026-03-01",
    totalCtrcs: 200,
    entregue: 150,
    foraTransp: 6,
    noPrazoOp: 190,
    foraPrazoOp: 10,
    noPrazoCli: 0,
    foraPrazoCli: 0,
  };

  it("Mês + uma coluna por métrica, percentual 0–100 com 1 casa e vazio sem base", () => {
    const x = exportacaoDaSerie(
      [ponto, { ...ponto, periodo: "2026-04-01", entregue: 0, totalCtrcs: 0 }],
      "mes",
      ["sla_ranking", "volume"],
    );
    expect(x.colunas.map((c) => c.titulo)).toEqual(["Mês", "SLA (%)", "CT-e emitidos"]);
    expect(x.linhas).toEqual([
      { periodo: "mar/2026", sla_ranking: 96, volume: 200 },
      { periodo: "abr/2026", sla_ranking: "", volume: 0 },
    ]);
  });

  it("dia a dia na Performance", () => {
    const x = exportacaoDaSerie([{ ...ponto, periodo: "2026-03-05" }], "dia", ["sla_op"]);
    expect(x.colunas.map((c) => c.titulo)).toEqual(["Dia", "SLA Operacional (%)"]);
    expect(x.linhas).toEqual([{ periodo: "05/03/2026", sla_op: 95 }]);
  });
});
