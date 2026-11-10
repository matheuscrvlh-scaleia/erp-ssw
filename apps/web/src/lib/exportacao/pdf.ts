// Só tipos: `import type` some no build e não puxa a biblioteca para o pacote inicial.
import type { jsPDF } from "jspdf";
import type { CellHookData, UserOptions } from "jspdf-autotable";

import { baixarArquivo, dataHoraGeracao, nomeDoArquivo } from "./arquivo";
import { textoDaCelula, valorDaLinha } from "./celulas";
import {
  carregarLogo,
  CORES,
  formatoDoLogo,
  hexParaRgb,
  type Marca,
  resolverMarca,
  rodapeDaMarca,
  SISTEMA,
} from "./marca";
import { ehLinkSsw, TEXTO_LINK_SSW } from "./ssw";
import { type OpcoesPdf } from "./tipos";

/**
 * PDF padrão: logo + título no topo de toda página, faixa na cor principal com acento de
 * destaque, tabela com cabeçalho na cor principal e linhas zebradas, rodapé com a marca e
 * "Página X de Y". origem: src/lib/exportacao/pdf.ts (sistema atual).
 * jsPDF e jspdf-autotable são carregados só no clique de exportar.
 */

const MARGEM = 28;
const TOPO = 74;
const MARGEM_BAIXO = 36;
const LOGO = 42;
/** Pontos por caractere da `largura` da coluna (fonte 7,5 pt). */
const PT_POR_CARACTERE = 5;

/** A fonte padrão do jsPDF (WinAnsi) não tem setas nem ≥/≤: viram lixo no arquivo. */
export function textoPdf(texto: string): string {
  return texto.replace(/→/g, "->").replace(/←/g, "<-").replace(/≥/g, ">=").replace(/≤/g, "<=");
}

/** Corpo da tabela em texto e o mapa das células que são link do SSW ("linha:coluna" → URL). */
export function montarCorpoPdf(o: OpcoesPdf, fuso: string) {
  const links = new Map<string, string>();
  const corpo = o.linhas.map((linha, i) =>
    o.colunas.map((coluna, j) => {
      const valor = valorDaLinha(linha, coluna.chave);
      if (ehLinkSsw(valor)) {
        links.set(`${i}:${j}`, valor);
        return TEXTO_LINK_SSW;
      }
      return textoPdf(textoDaCelula(valor, coluna.formato, fuso));
    }),
  );
  return { corpo, links };
}

function desenharCabecalho(doc: jsPDF, o: OpcoesPdf, marca: Marca, logo: string | null) {
  const largura = doc.internal.pageSize.getWidth();
  const primaria = hexParaRgb(marca.primaria);
  const suave = hexParaRgb(CORES.textoSuave);
  const formato = logo ? formatoDoLogo(logo) : null;
  const xTexto = logo && formato ? MARGEM + LOGO + 10 : MARGEM;
  if (logo && formato) {
    try {
      doc.addImage(logo, formato.toUpperCase(), MARGEM, 12, LOGO, LOGO, "logo", "FAST");
    } catch (erro) {
      console.warn("[exportacao] não foi possível desenhar o logo no PDF", erro);
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...primaria);
  doc.text(textoPdf(o.titulo), xTexto, 30);

  if (o.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...suave);
    const linhas: unknown = doc.splitTextToSize(
      textoPdf(o.subtitulo),
      largura - xTexto - MARGEM - 120,
    );
    (Array.isArray(linhas) ? linhas : [])
      .slice(0, 2)
      .forEach((l, i) => doc.text(String(l), xTexto, 42 + i * 10));
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...primaria);
  doc.text(textoPdf(`${marca.nome} · ${SISTEMA}`), largura - MARGEM, 28, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...suave);
  doc.text(`Gerado em ${dataHoraGeracao(marca.fuso)}`, largura - MARGEM, 39, { align: "right" });

  // Faixa: cor principal de ponta a ponta, com o acento de destaque sob o logo.
  doc.setDrawColor(...primaria);
  doc.setLineWidth(1.2);
  doc.line(MARGEM, 62, largura - MARGEM, 62);
  doc.setDrawColor(...hexParaRgb(marca.destaque));
  doc.setLineWidth(2.4);
  doc.line(MARGEM, 62, MARGEM + LOGO, 62);
}

function desenharRodape(doc: jsPDF, marca: Marca, pagina: number, total: number) {
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...hexParaRgb(CORES.linha));
  doc.setLineWidth(0.5);
  doc.line(MARGEM, altura - 26, largura - MARGEM, altura - 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...hexParaRgb(CORES.textoSuave));
  doc.text(textoPdf(rodapeDaMarca(marca)), MARGEM, altura - 15);
  doc.text(`Página ${pagina} de ${total}`, largura - MARGEM, altura - 15, { align: "right" });
}

export async function exportarPdf(o: OpcoesPdf): Promise<void> {
  const marca = resolverMarca(o.empresa);
  const [{ jsPDF: JsPdf }, { autoTable }, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    carregarLogo(marca.logoUrl),
  ]);
  const doc = new JsPdf({
    orientation: o.orientacao === "retrato" ? "portrait" : "landscape",
    unit: "pt",
    format: "a4",
    compress: true,
  });
  const primaria = hexParaRgb(marca.primaria);
  const { corpo, links } = montarCorpoPdf(o, marca.fuso);
  const chave = (d: CellHookData) => `${d.row.index}:${d.column.index}`;
  const larguras: UserOptions["columnStyles"] = Object.fromEntries(
    o.colunas.flatMap((c, i) =>
      c.largura ? [[i, { cellWidth: c.largura * PT_POR_CARACTERE }]] : [],
    ),
  );

  autoTable(doc, {
    startY: TOPO,
    theme: "striped",
    head: [o.colunas.map((c) => textoPdf(c.titulo))],
    body: corpo,
    columnStyles: larguras,
    styles: {
      font: "helvetica",
      fontSize: o.tamanhoFonte ?? 7.5,
      cellPadding: o.tamanhoFonte != null && o.tamanhoFonte < 7 ? 2 : 3,
      overflow: "linebreak",
      textColor: hexParaRgb(CORES.texto),
      lineColor: hexParaRgb(CORES.linha),
      lineWidth: 0.4,
    },
    headStyles: { fillColor: primaria, textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: hexParaRgb(CORES.zebra) },
    margin: { top: TOPO, bottom: MARGEM_BAIXO, left: MARGEM, right: MARGEM },
    didParseCell: (d) => {
      if (d.section === "body" && links.has(chave(d))) d.cell.styles.textColor = primaria;
    },
    didDrawCell: (d) => {
      const url = d.section === "body" ? links.get(chave(d)) : undefined;
      if (url) doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url });
    },
  });

  // Cabeçalho e rodapé por último, sobre a margem que a tabela deixou livre em cada página.
  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    desenharCabecalho(doc, o, marca, logo);
    desenharRodape(doc, marca, p, paginas);
  }
  baixarArquivo(doc.output("blob"), nomeDoArquivo(o.arquivo, "pdf"));
}
