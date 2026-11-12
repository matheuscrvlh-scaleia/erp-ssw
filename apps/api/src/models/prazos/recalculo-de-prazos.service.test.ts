import { randomUUID } from "node:crypto";

import { type RegraDePrazo } from "@erp/dominio/nucleo";
import { describe, expect, it } from "vitest";

import { type CteDoRecalculo, novasPrevisoes } from "./recalculo-de-prazos.service";

const regraParceiro: RegraDePrazo = {
  id: randomUUID(),
  tipo: "parceiro",
  unidadeCodigo: null,
  unidadeDestinoCodigo: null,
  parceiroCnpj: "X",
  prazoHoras: null,
  prazoDias: 5,
  ativo: true,
  criadoEm: new Date("2026-01-01"),
};

function cte(dados: Partial<CteDoRecalculo>): CteDoRecalculo {
  return {
    id: randomUUID(),
    parceiroCnpj: null,
    filial: "CAP",
    dataEmissao: "2026-11-04",
    dataPrevistaEntrega: "2026-11-09",
    prazoFonte: "ssw_038",
    dataBasePrazo: null,
    previsaoSswData: "2026-11-09",
    previsaoSswFonte: "ssw_038",
    previsaoSswDataBase: null,
    ...dados,
  };
}

describe("novasPrevisoes", () => {
  it("aplica a regra e devolve a previsão do SSW quando a regra sai; não mexe no que já está certo", () => {
    const comRegra = cte({ parceiroCnpj: "X" });
    const orfao = cte({ prazoFonte: "regra_unidade", dataPrevistaEntrega: "2026-11-06" });
    const certo = cte({});
    const novas = novasPrevisoes([comRegra, orfao, certo], [regraParceiro], new Map());
    expect(novas).toEqual([
      expect.objectContaining({
        cteId: comRegra.id,
        dataPrevistaEntrega: "2026-11-09",
        prazoFonte: "regra_parceiro",
        previsaoSswData: "2026-11-09",
        troca: null,
      }),
      expect.objectContaining({
        cteId: orfao.id,
        dataPrevistaEntrega: "2026-11-09",
        prazoFonte: "ssw_038",
        dataBasePrazo: null,
        troca: { dataAnterior: "2026-11-06", dataNova: "2026-11-09", fonte: "ssw_038" },
      }),
    ]);
  });
});
