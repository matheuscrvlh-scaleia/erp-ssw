import {
  type BlocoProducao,
  type Previstos,
  type RelatorioPeriodo,
} from "@erp/shared/contracts/performance";
import { describe, expect, it } from "vitest";

import { montarCsvEmSecoes } from "@/lib/export/csv";

import { csvDoRelatorio, impressaoDoRelatorio } from "./export";
import { type FiltrosDoRelatorio } from "./texts";

// origem: exportCsv, handlePrint/renderPrintBody e buildChips (RelatorioPeriodoPanel.tsx,
// sistema atual)

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
  slaPontualidadePct: 91.667,
  taxaRetornoPct: 2.5,
  totalCliente: 10,
  noPrazoCliente: 7,
  foraPrazoCliente: 3,
  slaClientePct: null,
};

const previstos: Previstos = {
  status: [{ key: "rota", qtd: 4, peso: 120.5, volumes: 9, frete: 800 }],
  faixa: [{ key: "hoje", qtd: 3, peso: 100.5, volumes: 7, frete: 700.5 }],
  total: { qtd: 4, peso: 120.5, volumes: 9, frete: 800 },
};

const unidade = {
  sigla: "CAP",
  cidade: "Campinas",
  uf: "SP",
  total: 500,
  entregues: 400,
  producaoPct: 80,
  slaOperacionalPct: 97.5,
  slaPontualidadePct: 90,
};

const foto = {
  periodo: { inicio: "2026-11-01", fim: "2026-11-10" },
  atual: bloco,
  porUnidade: [unidade, { ...unidade, sigla: "SAO", cidade: null, uf: null }],
  impactoCodigos: [
    {
      codigo: "13",
      descricao: "ENTREGA <PREJUDICADA>",
      penaliza: true,
      totalCtrcs: 30,
      totalPenalizantes: 30,
      pctDoTotal: 60,
    },
  ],
  impactoTotalPeriodo: 50,
  impactoBaseComOcorrencia: 50,
  penalizantes: { ocorrencias: 42, ctrcsAfetados: 30 },
  finalizadoPorCodigo: [{ codigo: 92, descricao: null, qtd: 8 }],
  previstosTodos: previstos,
  previstosPeriodo: { ...previstos, status: [], faixa: [] },
};

const relatorio: RelatorioPeriodo = {
  ...foto,
  comparativo: null,
  limites: { slaMetaPct: 95, taxaRetornoMetaPct: 3 },
};

const comComparativo: RelatorioPeriodo = {
  ...relatorio,
  comparativo: {
    ...foto,
    periodo: { inicio: "2026-10-01", fim: "2026-10-10" },
    atual: { ...bloco, totalCtrcs: 1000 },
    porUnidade: [{ ...unidade, total: 450 }],
  },
};

const semFiltro: FiltrosDoRelatorio = {
  unidades: [],
  parceiros: [],
  remetente: "",
  destino: "",
  filiais: [],
  codigos: [],
};

const filtros: FiltrosDoRelatorio = {
  unidades: ["Campinas", "Jundiaí", "Sorocaba", "Santos"],
  parceiros: ["ACME"],
  remetente: "a||b",
  destino: "",
  filiais: ["CAP"],
  codigos: ["25", "69"],
};

describe("CSV do relatório", () => {
  it("seções, rótulos e números no formato de hoje", () => {
    const csv = csvDoRelatorio(relatorio, "todos", filtros);
    expect(csv.arquivo).toBe("relatorio-periodo-2026-11-01_2026-11-10");
    expect(montarCsvEmSecoes(csv.linhas).split("\n")).toEqual([
      "# Relatório de período · 2026-11-01 → 2026-11-10",
      "# Filtros herdados: Unidades=Campinas, Jundiaí, Sorocaba +1 | Parceiros=ACME | Remetente=a · b | Filiais=CAP | Ocorrências=25, 69",
      "",
      "# Indicadores globais",
      "Indicador;Valor",
      "CT-e emitidos;1200",
      "Entregues;900",
      "Finalizado em Sistema;12",
      '% Produção;"75,00"',
      "No prazo;800",
      "Fora do prazo;100",
      'SLA de Pontualidade;"96,40"',
      'SLA Operacional;"91,67"',
      "SLA Cliente;",
      'Taxa de retorno;"2,50"',
      "Penalizantes (ocorrências);42",
      "Penalizantes (CTRCs afetados);30",
      '"Prejuízo (R$) — códigos 25, 69";"234,50"',
      'Prejuízo (%);"1,90"',
      "",
      "# Previstos (Todos em aberto)",
      "Eixo;Chave;Qtd;Peso (kg);Volumes;Frete (R$)",
      'Status;rota;4;120.5;9;"800,00"',
      'Vencimento;hoje;3;100.5;7;"700,50"',
      "",
      "# Finalizado em Sistema por código",
      "Código;Descrição;Qtd",
      "92;—;8",
      "",
      "# SLA por unidade",
      "Unidade;Cidade;UF;Emitidos;Entregues;% Produção;SLA Pont. (%);SLA Op. (%)",
      'CAP;Campinas;SP;500;400;"80,00";"97,50";"90,00"',
      'SAO;;;500;400;"80,00";"97,50";"90,00"',
    ]);
  });

  it("comparativo: linha do período, previstos do modo do painel e pares P/C por unidade", () => {
    const texto = montarCsvEmSecoes(csvDoRelatorio(comComparativo, "periodo", semFiltro).linhas);
    const linhas = texto.split("\n");
    expect(linhas[1]).toBe("# Comparativo · 2026-10-01 → 2026-10-10");
    expect(linhas).toContain("# Previstos (Emitidos no período)");
    expect(linhas).toContain('Prejuízo (R$) — código 13;"234,50"');
    expect(linhas).toContain(
      "Unidade;Cidade;UF;Emitidos (P);Emitidos (C);Entregues (P);Entregues (C);% Produção (P);% Produção (C);SLA Pont. (P);SLA Pont. (C);SLA Op. (P);SLA Op. (C)",
    );
    expect(linhas).toContain(
      'CAP;Campinas;SP;500;450;400;400;"80,00";"80,00";"97,50";"97,50";"90,00";"90,00"',
    );
    expect(linhas).toContain('SAO;;;500;;400;;"80,00";;"97,50";;"90,00";');
  });
});

describe("Imprimir do relatório", () => {
  it("cabeçalho, filtros e seções na ordem de hoje", () => {
    const p = impressaoDoRelatorio(relatorio, "todos", filtros);
    expect(p.tituloDaJanela).toBe("Relatório de período — 01/11/2026 a 10/11/2026");
    expect(p.titulo).toBe("Relatório de Período");
    expect(p.subtitulo).toBe("Período: 01/11/2026 a 10/11/2026");
    expect(p.extraHtml).toBe(
      '<div class="print-filters">Filtros: <span><strong>Unidades:</strong> Campinas, Jundiaí, Sorocaba +1</span> · <span><strong>Parceiros:</strong> ACME</span> · <span><strong>Remetente:</strong> a · b</span> · <span><strong>Filiais:</strong> CAP</span> · <span><strong>Ocorrências:</strong> 25, 69</span></div>',
    );
    expect(p.estilos).toContain("size: A4 portrait; margin: 15mm");
    const ordem = [
      "<h4>Produção</h4>",
      "<h4>Qualidade</h4>",
      "<h4>Previstos · Todos em aberto</h4>",
      "SLA por unidade",
      "Finalizado em Sistema por código",
      "Impacto por código de última ocorrência",
    ].map((t) => p.corpoHtml.indexOf(t));
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    expect(p.corpoHtml).toContain("Universo separado (responsabilidade do cliente)");
    expect(p.corpoHtml).toContain("meta 95,0%");
    expect(p.corpoHtml).toContain("códigos 25, 69 · 1,9% de R$");
    expect(p.corpoHtml).toContain("ENTREGA &lt;PREJUDICADA&gt;");
    expect(p.corpoHtml).toContain("base: 50 CTRCs");
    expect(p.corpoHtml).not.toContain("(P)");
  });

  it("comparativo no cabeçalho, 'vs' nos cards e coluna (C) com '—' sem movimento", () => {
    const p = impressaoDoRelatorio(comComparativo, "periodo", semFiltro);
    expect(p.extraHtml).toBe(
      '<div class="print-sub"><strong>Comparativo:</strong> 01/10/2026 a 10/10/2026</div>',
    );
    expect(p.corpoHtml).toContain('vs <span class="cmp-val">1.000</span>');
    expect(p.corpoHtml).toContain('<span class="delta good">▲ 20,0%</span>');
    expect(p.corpoHtml).toContain("SLA por unidade · P = principal · C = comparativo");
    expect(p.corpoHtml).toContain('<td class="num" style="color:#666">—</td>');
    expect(p.corpoHtml).toContain("Previstos · Emitidos no período");
    expect(p.corpoHtml).toContain("Sem dados.");
  });
});
