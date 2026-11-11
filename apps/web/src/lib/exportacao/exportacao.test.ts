import { describe, expect, it } from "vitest";

import { nomeDoArquivo, sufixoHoje } from "./arquivo";
import { celulaExcel, paraDiaIso, textoCsv, textoDaCelula, valorDaLinha } from "./celulas";
import { montarCsv, montarCsvEmSecoes } from "./csv";
import { carregarExcelJs, montarPlanilha } from "./excel";
import { escaparHtml, montarDocumentoImpresso, montarHtmlImpressao } from "./impressao";
import { formatoDoLogo, resolverMarca, rodapeDaMarca } from "./marca";
import { montarCorpoPdf, textoPdf } from "./pdf";
import { ehLinkSsw, urlCtrcNoSsw } from "./ssw";
import { type ColunaExportacao, type EmpresaExportacao } from "./tipos";

const FR: EmpresaExportacao = {
  nome: "FR Transportes",
  slogan: "Logística e Locações",
  corPrimaria: "#212a63",
  corDestaque: "#c0392b",
  logoUrl: null,
};

const COLUNAS: ColunaExportacao[] = [
  { chave: "ctrc", titulo: "CTRC" },
  { chave: "emissao", titulo: "Emissão", formato: "data" },
  { chave: "frete", titulo: "Frete (R$)", formato: "moeda" },
  { chave: "sla", titulo: "SLA", formato: "percentual" },
  { chave: "link", titulo: "Link SSW" },
];

const LINK = urlCtrcNoSsw("CAP", 33214, "2026-11-05");
const LINHAS = [
  { ctrc: "CAP033214", emissao: "2026-11-05", frete: 1234.5, sla: 0.951, link: LINK },
  { ctrc: 'Texto; com "aspas"', emissao: null, frete: "10", sla: undefined, link: "" },
];

describe("células", () => {
  it("lê a propriedade pela chave, e ausente vira undefined", () => {
    expect(valorDaLinha({ a: 1 }, "a")).toBe(1);
    expect(valorDaLinha({ a: 1 }, "b")).toBeUndefined();
  });

  it("formata para a tela/PDF em pt-BR, vazio sem traço", () => {
    expect(textoDaCelula(1234.5, "moeda")).toBe("R$ 1.234,50");
    expect(textoDaCelula(0.951, "percentual")).toBe("95,1%");
    expect(textoDaCelula(12345, "inteiro")).toBe("12.345");
    expect(textoDaCelula("12.5", "decimal")).toBe("12,5");
    expect(textoDaCelula("2026-11-05", "data")).toBe("05/11/2026");
    expect(textoDaCelula("2026-11-06T01:30:00Z", "datahora")).toBe("05/11/2026 22:30");
    expect(textoDaCelula(true)).toBe("Sim");
    expect(textoDaCelula(["a", "b"])).toBe("a, b");
    expect(textoDaCelula(null, "moeda")).toBe("");
    expect(textoDaCelula("sem número", "moeda")).toBe("sem número");
  });

  it("instante com hora vira o dia de Brasília (22h30 do dia 5 não é dia 6)", () => {
    expect(paraDiaIso("2026-11-06T01:30:00Z", "America/Sao_Paulo")).toBe("2026-11-05");
    expect(textoDaCelula("2026-11-06T01:30:00Z", "data")).toBe("05/11/2026");
  });

  it("CSV usa vírgula decimal sem milhar e data dd/mm/aaaa", () => {
    expect(textoCsv(1234.5, "moeda")).toBe("1234,50");
    expect(textoCsv(1234.5, "decimal")).toBe("1234,5");
    expect(textoCsv(0.951, "percentual")).toBe("95,1%");
    // Mesmo arredondamento da tela: antes o CSV dava "95,0%" e o PDF "95,1%" para 0,9505.
    expect(textoCsv(0.9505, "percentual")).toBe(textoDaCelula(0.9505, "percentual"));
    expect(textoCsv("2026-11-05", "data")).toBe("05/11/2026");
  });

  it("Excel recebe número e data de verdade", () => {
    expect(celulaExcel(1234.5, "moeda")).toEqual({ valor: 1234.5, formatoNumero: '"R$" #,##0.00' });
    expect(celulaExcel("2026-11-05", "data")).toEqual({
      valor: new Date("2026-11-05T00:00:00Z"),
      formatoNumero: "dd/mm/yyyy",
    });
    expect(celulaExcel("2026-11-06T01:30:00Z", "datahora")?.valor).toEqual(
      new Date("2026-11-05T22:30:00Z"),
    );
    expect(celulaExcel("", "moeda")).toBeNull();
    expect(celulaExcel("abc", "inteiro")).toEqual({ valor: "abc" });
  });
});

describe("link do SSW", () => {
  it("monta a URL com número de 6 dígitos e data ddmmaa", () => {
    expect(LINK).toBe(
      "https://sistema.ssw.inf.br/bin/ssw0053?act=P1&t_ser_ctrc=CAP&t_nro_ctrc=033214&t_data_ini=051126&t_data_fin=051126",
    );
    expect(ehLinkSsw(LINK)).toBe(true);
  });

  it("sem sigla, número ou emissão não há link", () => {
    expect(urlCtrcNoSsw(null, 1, "2026-11-05")).toBeNull();
    expect(urlCtrcNoSsw("CAP", "", "2026-11-05")).toBeNull();
    expect(urlCtrcNoSsw("CAP", 1, null)).toBeNull();
  });
});

describe("nome do arquivo", () => {
  const dia = new Date(2026, 10, 10);
  it("acrescenta a data e a extensão uma vez só", () => {
    expect(sufixoHoje(dia)).toBe("10-11-2026");
    expect(nomeDoArquivo("romaneio-hoje", "pdf", dia)).toBe("romaneio-hoje-10-11-2026.pdf");
    expect(nomeDoArquivo("romaneio-hoje-09-11-2026", "pdf", dia)).toBe(
      "romaneio-hoje-09-11-2026.pdf",
    );
    expect(nomeDoArquivo("lista.xlsx", "xlsx", dia)).toBe("lista-10-11-2026.xlsx");
  });
  it("base que já termina em data AAAA-MM-DD (período do relatório) não ganha outra", () => {
    expect(nomeDoArquivo("relatorio-periodo-2026-11-01-2026-11-10", "xlsx", dia)).toBe(
      "relatorio-periodo-2026-11-01-2026-11-10.xlsx",
    );
    expect(nomeDoArquivo("relatorio-periodo-2026-11-01_2026-11-10", "csv", dia)).toBe(
      "relatorio-periodo-2026-11-01_2026-11-10.csv",
    );
  });
});

describe("marca", () => {
  it("cor inválida cai na cor do tema; sem slogan o rodapé leva só o nome", () => {
    const marca = resolverMarca({ nome: "Outra", corPrimaria: "azul", slogan: null });
    expect(marca.primaria).toBe("#212a63");
    expect(marca.destaque).toBe("#c0392b");
    expect(rodapeDaMarca(marca)).toBe("Outra");
    expect(rodapeDaMarca(resolverMarca(FR))).toBe("FR Transportes — Logística e Locações");
  });

  it("só aceita logo PNG ou JPEG", () => {
    expect(formatoDoLogo("data:image/png;base64,AA")).toBe("png");
    expect(formatoDoLogo("data:image/jpeg;base64,AA")).toBe("jpeg");
    expect(formatoDoLogo("data:image/svg+xml;base64,AA")).toBeNull();
  });
});

describe("CSV", () => {
  it("só dados: cabeçalho + linhas com ';' e aspas escapadas, link como URL", () => {
    expect(montarCsv(COLUNAS, LINHAS).split("\n")).toEqual([
      "CTRC;Emissão;Frete (R$);SLA;Link SSW",
      `CAP033214;05/11/2026;1234,50;95,1%;${LINK ?? ""}`,
      '"Texto; com ""aspas""";;10,00;;',
    ]);
  });

  it("texto que começa com = + - @, tab ou CR sai com ' (sem virar fórmula); número não muda", () => {
    const colunas = [
      { chave: "nome", titulo: "Nome" },
      { chave: "valor", titulo: "Valor", formato: "decimal" as const },
    ];
    const linhas = [
      { nome: '=HYPERLINK("http://x")', valor: -5 },
      { nome: "+1", valor: "-2.5" },
      { nome: "-2+3", valor: null },
      { nome: "@SOMA(A1)", valor: null },
      { nome: "\tcmd", valor: null },
      { nome: "\rcmd", valor: null },
      { nome: "Normal - ok", valor: null },
    ];
    expect(montarCsv(colunas, linhas).split("\n").slice(1)).toEqual([
      `"'=HYPERLINK(""http://x"")";-5`,
      "'+1;-2,5",
      "'-2+3;",
      "'@SOMA(A1);",
      "'\tcmd;",
      `"'\rcmd";`,
      "Normal - ok;",
    ]);
  });
});

describe("CSV em seções", () => {
  it("títulos crus, células com ; e aspas também na vírgula; fórmula com ', número não", () => {
    expect(
      montarCsvEmSecoes([
        "# Título, com vírgula",
        "",
        ["Indicador", "Valor"],
        ["Prejuízo (R$) — códigos 13, 69", "1234,50"],
        ["=SOMA(A1)", -3],
        ["-2+3", "-1,50"],
        ['Texto "x"; y', 120.5],
      ]).split("\n"),
    ).toEqual([
      "# Título, com vírgula",
      "",
      "Indicador;Valor",
      '"Prejuízo (R$) — códigos 13, 69";"1234,50"',
      "'=SOMA(A1);-3",
      `'-2+3;"-1,50"`,
      '"Texto ""x""; y";120.5',
    ]);
  });
});

describe("PDF", () => {
  it("troca setas e ≥ que a fonte do PDF não tem", () => {
    expect(textoPdf("A → B ≥ C")).toBe("A -> B >= C");
  });

  it("link do SSW vira 'Abrir no SSW' clicável", () => {
    const { corpo, links } = montarCorpoPdf(
      { arquivo: "x", titulo: "T", colunas: COLUNAS, linhas: LINHAS, empresa: FR },
      "America/Sao_Paulo",
    );
    expect(corpo[0]).toEqual(["CAP033214", "05/11/2026", "R$ 1.234,50", "95,1%", "Abrir no SSW"]);
    expect(links.get("0:4")).toBe(LINK);
    expect(links.size).toBe(1);
  });
});

describe("impressão", () => {
  it("escapa HTML e leva marca, título e linhas", () => {
    const html = montarHtmlImpressao(
      {
        titulo: "Romaneio <hoje>",
        subtitulo: "Período: 01/11/2026 a 10/11/2026",
        colunas: COLUNAS,
        linhas: LINHAS,
        empresa: FR,
      },
      null,
      new Date("2026-11-10T15:00:00Z"),
    );
    expect(html).toContain("Romaneio &lt;hoje&gt;");
    expect(html).toContain("FR Transportes · Painel BI");
    expect(html).toContain("Gerado em 10/11/2026 12:00");
    expect(html).toContain("Texto; com &quot;aspas&quot;");
    expect(html).toContain(">SSW</a>");
    expect(html).toContain("size: A4 portrait");
    expect(html).not.toContain("<img");
    expect(escaparHtml(`<a href="x">'`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;");
  });
});

describe("documento impresso", () => {
  it("cabeçalho da empresa com extra, CSS próprio e cor da marca em variável", () => {
    const html = montarDocumentoImpresso(
      {
        empresa: FR,
        tituloDaJanela: "Relatório de período — 01/11/2026 a 10/11/2026",
        titulo: "Relatório <de> Período",
        subtitulo: "Período: 01/11/2026 a 10/11/2026",
        extraHtml: '<div class="print-sub">extra</div>',
        estilos: "@page { size: A4 portrait; margin: 15mm; }",
        corpoHtml: "<section>corpo</section>",
      },
      null,
      new Date("2026-11-10T15:00:00Z"),
    );
    expect(html).toContain("<title>Relatório de período — 01/11/2026 a 10/11/2026</title>");
    expect(html).toContain("Relatório &lt;de&gt; Período");
    expect(html).toContain('<div class="print-sub">extra</div>');
    expect(html).toContain("--marca-primaria: #212a63");
    expect(html).toContain("margin: 15mm");
    expect(html).toContain("<section>corpo</section>");
    expect(html).toContain("Gerado em 10/11/2026 12:00");
  });
});

describe("Excel", () => {
  it("topo com título e marca, cabeçalho na linha 6 com filtro, valores nativos", async () => {
    const ExcelJS = await carregarExcelJs();
    const wb = montarPlanilha(
      ExcelJS,
      {
        arquivo: "x",
        titulo: "Romaneio",
        subtitulo: "Período",
        colunas: COLUNAS,
        linhas: LINHAS,
        empresa: FR,
      },
      null,
    );
    const ws = wb.getWorksheet("Romaneio");
    expect(ws).toBeDefined();
    if (!ws) return;
    expect(ws.getCell(1, 2).value).toBe("Romaneio");
    expect(ws.getCell(2, 2).value).toBe("Período");
    expect(ws.getCell(3, 2).text).toContain("FR Transportes · Painel BI");
    expect(ws.getRow(6).values).toEqual([
      undefined,
      "CTRC",
      "Emissão",
      "Frete (R$)",
      "SLA",
      "Link SSW",
    ]);
    expect(ws.getCell(7, 3).value).toBe(1234.5);
    expect(ws.getCell(7, 3).numFmt).toBe('"R$" #,##0.00');
    expect(ws.getCell(7, 5).value).toEqual({ text: "Abrir no SSW", hyperlink: LINK });
    expect(ws.getCell(8, 3).value).toBe(10);
    expect(ws.autoFilter).toEqual({ from: { row: 6, column: 1 }, to: { row: 8, column: 5 } });
    expect(ws.headerFooter.oddFooter).toBe(
      "&L&8FR Transportes — Logística e Locações&R&8Página &P de &N",
    );
  }, 30_000);
  it("abas extras no mesmo desenho, com nome único e o título próprio", async () => {
    const ExcelJS = await carregarExcelJs();
    const wb = montarPlanilha(
      ExcelJS,
      {
        arquivo: "x",
        titulo: "Relatório de período",
        subtitulo: "Período",
        colunas: COLUNAS,
        linhas: LINHAS,
        empresa: FR,
        abasExtras: [
          {
            nome: "SLA por unidade",
            titulo: "SLA por unidade",
            colunas: [
              { chave: "unidade", titulo: "Unidade" },
              { chave: "status", titulo: "Status" },
            ],
            linhas: [{ unidade: "CAP", status: "Verde" }],
          },
          { nome: "sla por unidade", colunas: [], linhas: [] },
        ],
      },
      null,
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Relatório de período",
      "SLA por unidade",
      "sla por unidade (2)",
    ]);
    const ws = wb.getWorksheet("SLA por unidade");
    expect(ws).toBeDefined();
    if (!ws) return;
    expect(ws.getCell(1, 2).value).toBe("SLA por unidade");
    expect(ws.getCell(2, 2).value).toBe("Período");
    expect(ws.getCell(3, 2).text).toContain("FR Transportes · Painel BI");
    expect(ws.getRow(6).values).toEqual([undefined, "Unidade", "Status"]);
    expect(ws.getRow(7).values).toEqual([undefined, "CAP", "Verde"]);
    expect(ws.getCell(6, 1).fill).toEqual({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF212A63" },
    });
    expect(wb.getWorksheet("sla por unidade (2)")?.getCell(1, 2).value).toBe(
      "Relatório de período",
    );
  }, 30_000);
  it("nome da aba principal e notas acima da tabela, com uma linha em branco", async () => {
    const ExcelJS = await carregarExcelJs();
    const wb = montarPlanilha(
      ExcelJS,
      {
        arquivo: "x",
        titulo: "Relatório de período",
        nomeDaAba: "Resumo",
        notas: ["Filtros aplicados:", "• Filiais: CAP"],
        colunas: [
          { chave: "indicador", titulo: "Indicador" },
          { chave: "valor", titulo: "Valor" },
        ],
        linhas: [{ indicador: "CT-e emitidos", valor: 1234 }],
        empresa: FR,
        abasExtras: [
          {
            nome: "Previstos (todos)",
            notas: ["Total: 3 CTRCs"],
            colunas: [{ chave: "qtd", titulo: "Qtd" }],
            linhas: [{ qtd: 3 }],
          },
        ],
      },
      null,
    );
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Resumo", "Previstos (todos)"]);
    const resumo = wb.getWorksheet("Resumo");
    if (!resumo) throw new Error("sem a aba Resumo");
    expect(resumo.getCell(6, 1).value).toBe("Filtros aplicados:");
    expect(resumo.getCell(7, 1).value).toBe("• Filiais: CAP");
    expect(resumo.getCell(8, 1).value).toBeNull();
    expect(resumo.getRow(9).values).toEqual([undefined, "Indicador", "Valor"]);
    // Número sem formato de coluna sai cru, como no sistema atual.
    expect(resumo.getCell(10, 2).value).toBe(1234);
    expect(resumo.getCell(10, 2).numFmt).toBeUndefined();
    expect(resumo.views[0]).toMatchObject({ state: "frozen", ySplit: 9 });
    expect(resumo.pageSetup.printTitlesRow).toBe("9:9");
    const previstos = wb.getWorksheet("Previstos (todos)");
    expect(previstos?.getCell(6, 1).value).toBe("Total: 3 CTRCs");
    expect(previstos?.getRow(8).values).toEqual([undefined, "Qtd"]);
  }, 30_000);
});
