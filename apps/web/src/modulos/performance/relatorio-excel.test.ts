import {
  type BlocoProducao,
  type Previstos,
  type RelatorioPeriodo,
} from "@erp/shared/contratos/performance";
import { describe, expect, it } from "vitest";

import { type AbaExcel } from "@/lib/exportacao";

import { excelDoRelatorio, type FiltrosDoRelatorio, notasDosFiltros } from "./relatorio";

// origem dos rótulos e da ordem: exportRelatorioXlsx (relatorio-semanal-export.ts, sistema atual)

const bloco: BlocoProducao = {
  totalCtrcs: 1200,
  entregues: 900,
  finalizadoSistema: 12,
  previstos: 300,
  devolvidos: 3,
  noPrazo: 800,
  foraPrazo: 100,
  pendentePrazo: 40,
  semPrazo: 5,
  valorFreteTotal: 12345.6,
  valorFretePerdido: 234.5,
  pctFretePerdido: 1.9,
  slaOperacionalPct: 96.4,
  slaPontualidadePct: 91.67,
  taxaRetornoPct: 2.5,
  totalCliente: 10,
  noPrazoCliente: 7,
  foraPrazoCliente: 3,
  slaClientePct: null,
};

const previstos: Previstos = {
  status: [{ key: "rota", qtd: 4, peso: 120.5, volumes: 9, frete: 800 }],
  faixa: [
    { key: "vencido", qtd: 1, peso: 20, volumes: 2, frete: 100 },
    { key: "hoje", qtd: 3, peso: 100.5, volumes: 7, frete: 700 },
  ],
  total: { qtd: 4, peso: 120.5, volumes: 9, frete: 800 },
};

const foto = {
  periodo: { inicio: "2026-11-01", fim: "2026-11-10" },
  atual: bloco,
  porUnidade: [],
  impactoCodigos: [
    {
      codigo: "13",
      descricao: "ENTREGA PREJUDICADA",
      penaliza: true,
      totalCtrcs: 30,
      totalPenalizantes: 30,
      pctDoTotal: 60,
    },
    {
      codigo: "25",
      descricao: null,
      penaliza: false,
      totalCtrcs: 20,
      totalPenalizantes: 0,
      pctDoTotal: 40,
    },
  ],
  impactoTotalPeriodo: 50,
  impactoBaseComOcorrencia: 50,
  penalizantes: { ocorrencias: 42, ctrcsAfetados: 30 },
  finalizadoPorCodigo: [
    { codigo: 92, descricao: "BAIXA ADMINISTRATIVA", qtd: 8 },
    { codigo: 99, descricao: null, qtd: 4 },
  ],
  previstosTodos: previstos,
  previstosPeriodo: { ...previstos, total: { ...previstos.total, qtd: 2 } },
};

const relatorio: RelatorioPeriodo = {
  ...foto,
  comparativo: null,
  limites: { slaMetaPct: 95, taxaRetornoMetaPct: 3 },
};

const semFiltro: FiltrosDoRelatorio = {
  unidades: [],
  parceiros: [],
  remetente: "",
  destino: "",
  filiais: [],
  codigos: [],
};

const aba = (abas: readonly AbaExcel[] | undefined, nome: string) =>
  abas?.find((a) => a.nome === nome);

describe("Excel do relatório de período", () => {
  it("arquivo, título, subtítulo e abas na ordem de hoje", () => {
    const x = excelDoRelatorio(relatorio, [], semFiltro);
    expect(x.arquivo).toBe("relatorio-periodo-2026-11-01-2026-11-10");
    expect(x.titulo).toBe("Relatório de período");
    expect(x.subtitulo).toBe("Período: 01/11/2026 a 10/11/2026");
    expect(x.nomeDaAba).toBe("Resumo");
    expect(x.notas).toEqual([]);
    expect([x.nomeDaAba, ...(x.abasExtras ?? []).map((a) => a.nome)]).toEqual([
      "Resumo",
      "SLA por unidade",
      "Previstos (todos)",
      "Previstos (período)",
      "Finalizado em Sistema",
      "Impacto por código",
    ]);
  });

  it("Resumo: Indicador | Valor, números crus e percentuais em texto", () => {
    const x = excelDoRelatorio(relatorio, ["25"], semFiltro);
    expect(x.colunas.map((c) => c.titulo)).toEqual(["Indicador", "Valor"]);
    expect(x.colunas.every((c) => c.formato === undefined)).toBe(true);
    const linhas = x.linhas as { indicador: string; valor: string | number }[];
    expect(linhas.map((l) => l.indicador)).toEqual([
      "CT-e emitidos",
      "Entregues",
      "Finalizado em Sistema",
      "% Produção (entregues/emitidos)",
      "No prazo",
      "Fora do prazo",
      "% No prazo",
      "% Penalizado Pontualidade",
      "% Penalizado Operacional",
      "Pendentes de prazo",
      "Sem prazo definido",
      "SLA de Pontualidade",
      "SLA Operacional",
      "SLA Cliente",
      "SLA Cliente — no prazo",
      "SLA Cliente — fora do prazo",
      "SLA Cliente — total (universo)",
      "Taxa de retorno (código 13)",
      "Valor de frete romaneado",
      "Prejuízo (R$) — código 25",
      "Prejuízo (% dos romaneados)",
      "Penalizantes — ocorrências",
      "Penalizantes — CTRCs afetados",
    ]);
    const valor = new Map(linhas.map((l) => [l.indicador, l.valor]));
    expect(valor.get("CT-e emitidos")).toBe(1200);
    expect(valor.get("% Produção (entregues/emitidos)")).toBe("75,0%");
    expect(valor.get("% No prazo")).toBe("88,9%");
    // Rótulos cruzados de propósito, como hoje (Q01).
    expect(valor.get("% Penalizado Pontualidade")).toBe("3,6%");
    expect(valor.get("% Penalizado Operacional")).toBe("8,3%");
    expect(valor.get("SLA de Pontualidade")).toBe("96,4%");
    expect(valor.get("SLA Operacional")).toBe("91,7%");
    expect(valor.get("SLA Cliente")).toBe("—");
    expect(valor.get("Valor de frete romaneado")).toMatch(/^R\$\s12\.345,60$/);
    expect(valor.get("Penalizantes — CTRCs afetados")).toBe(30);
  });

  it("Resumo no comparativo: Período principal | Período comparativo, e subtítulo com os dois", () => {
    const x = excelDoRelatorio(
      {
        ...relatorio,
        comparativo: {
          ...foto,
          periodo: { inicio: "2026-10-01", fim: "2026-10-10" },
          atual: { ...bloco, totalCtrcs: 1000 },
          penalizantes: { ocorrencias: 9, ctrcsAfetados: 7 },
        },
      },
      [],
      semFiltro,
    );
    expect(x.subtitulo).toBe(
      "Período: 01/11/2026 a 10/11/2026 · comparativo: 01/10/2026 a 10/10/2026",
    );
    expect(x.colunas.map((c) => c.titulo)).toEqual([
      "Indicador",
      "Período principal",
      "Período comparativo",
    ]);
    expect(x.linhas[0]).toEqual({ indicador: "CT-e emitidos", valor: 1200, comparativo: 1000 });
    expect(x.linhas.at(-1)).toEqual({
      indicador: "Penalizantes — CTRCs afetados",
      valor: 30,
      comparativo: 7,
    });
    const impacto = aba(x.abasExtras, "Impacto por código");
    expect(impacto?.colunas.map((c) => c.titulo)).toEqual([
      "Código",
      "Descrição",
      "CTRCs (P)",
      "CTRCs (C)",
      "% total (P)",
      "% total (C)",
    ]);
    expect(impacto?.linhas[0]).toEqual({
      codigo: "13",
      descricao: "ENTREGA PREJUDICADA",
      ctrcs: 30,
      ctrcsC: 30,
      pct: "60,0%",
      pctC: "60,0%",
    });
  });

  it("Previstos: total nas notas e Eixo | Chave | Qtd | Peso (kg) | Volumes | Frete (R$) crus", () => {
    const x = excelDoRelatorio(relatorio, [], semFiltro);
    const todos = aba(x.abasExtras, "Previstos (todos)");
    expect(todos?.titulo).toBe("Previstos — Todos em aberto");
    expect(todos?.notas).toHaveLength(1);
    expect(todos?.notas?.[0]).toMatch(/^Total: 4 CTRCs · Peso: 120\.5 kg · Frete: R\$\s800,00$/);
    expect(todos?.colunas.map((c) => c.titulo)).toEqual([
      "Eixo",
      "Chave",
      "Qtd",
      "Peso (kg)",
      "Volumes",
      "Frete (R$)",
    ]);
    expect(todos?.colunas.every((c) => c.formato === undefined)).toBe(true);
    expect(todos?.linhas).toEqual([
      { eixo: "Status", chave: "rota", qtd: 4, peso: 120.5, volumes: 9, frete: 800 },
      { eixo: "Vencimento", chave: "vencido", qtd: 1, peso: 20, volumes: 2, frete: 100 },
      { eixo: "Vencimento", chave: "hoje", qtd: 3, peso: 100.5, volumes: 7, frete: 700 },
    ]);
    const periodo = aba(x.abasExtras, "Previstos (período)");
    expect(periodo?.titulo).toBe("Previstos — Emitidos no período");
    expect(periodo?.notas?.[0]).toMatch(/^Total: 2 CTRCs/);
  });

  it("Finalizado em Sistema e Impacto por código: colunas de hoje, '—' sem descrição", () => {
    const x = excelDoRelatorio(relatorio, [], semFiltro);
    const finalizado = aba(x.abasExtras, "Finalizado em Sistema");
    expect(finalizado?.titulo).toBe("Finalizado em Sistema");
    expect(finalizado?.colunas.map((c) => c.titulo)).toEqual(["Código", "Descrição", "Qtd"]);
    expect(finalizado?.linhas).toEqual([
      { codigo: 92, descricao: "BAIXA ADMINISTRATIVA", qtd: 8 },
      { codigo: 99, descricao: "—", qtd: 4 },
    ]);
    const impacto = aba(x.abasExtras, "Impacto por código");
    expect(impacto?.titulo).toBe("Impacto por código");
    expect(impacto?.colunas.map((c) => c.titulo)).toEqual([
      "Código",
      "Descrição",
      "CTRCs",
      "% total",
    ]);
    expect(impacto?.linhas[1]).toMatchObject({
      codigo: "25",
      descricao: "—",
      ctrcs: 20,
      pct: "40,0%",
    });
  });

  it("sem linhas, as abas Finalizado em Sistema e Impacto por código não saem", () => {
    const x = excelDoRelatorio(
      { ...relatorio, finalizadoPorCodigo: [], impactoCodigos: [] },
      [],
      semFiltro,
    );
    expect((x.abasExtras ?? []).map((a) => a.nome)).toEqual([
      "SLA por unidade",
      "Previstos (todos)",
      "Previstos (período)",
    ]);
  });
});

describe("notas de filtro da aba Resumo", () => {
  it("lista os filtros por extenso, na ordem de hoje", () => {
    expect(
      notasDosFiltros({
        unidades: ["Campinas", "Sorocaba"],
        parceiros: ["ACME LTDA"],
        remetente: " a|b ",
        destino: "SP",
        filiais: ["CAP"],
        codigos: ["13", "25"],
      }),
    ).toEqual([
      "Filtros aplicados:",
      "• Unidades: Campinas, Sorocaba",
      "• Parceiros: ACME LTDA",
      "• Remetente: a|b",
      "• Destino: SP",
      "• Filiais: CAP",
      "• Códigos: 13, 25",
    ]);
  });
});
