// Só tipos: `import type` some no build e não puxa a biblioteca para o pacote inicial.
import type * as ExcelJsTipos from "exceljs";
import type { Workbook, Worksheet } from "exceljs";

import { baixarArquivo, dataHoraGeracao, nomeDoArquivo } from "./arquivo";
import { celulaExcel, textoDaCelula, valorDaLinha } from "./celulas";
import {
  carregarLogo,
  CORES,
  formatoDoLogo,
  type Marca,
  resolverMarca,
  rodapeDaMarca,
  SISTEMA,
} from "./marca";
import { ehLinkSsw, TEXTO_LINK_SSW } from "./ssw";
import { type OpcoesExcel } from "./tipos";

/**
 * Excel padrão: logo + título + contexto no topo, faixa na cor principal com acento de
 * destaque sob o logo, cabeçalho da tabela na cor principal com filtro e congelado, rodapé de
 * impressão com a marca. origem: src/lib/exportacao/excel.ts (sistema atual).
 *
 * `exceljs` (e não SheetJS) porque o SheetJS gratuito não grava imagem nem cor. Carregado só no
 * clique de exportar (o campo "browser" do pacote aponta o Vite para o build de navegador).
 */

type ModuloExcel = typeof ExcelJsTipos;

const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** A coluna A guarda o logo (~64 px): nunca mais estreita que isso. */
const LARGURA_MIN = 11;
const LARGURA_MAX = 50;
/** Linhas usadas para estimar a largura; varrer 10 mil só deixa o clique lento. */
const AMOSTRA_LARGURA = 500;

const argb = (hex: string) => `FF${hex.slice(1).toUpperCase()}`;

function ehModuloExcel(modulo: unknown): modulo is ModuloExcel {
  return typeof modulo === "object" && modulo !== null && "Workbook" in modulo;
}

export async function carregarExcelJs(): Promise<ModuloExcel> {
  const modulo: unknown = await import("exceljs");
  if (ehModuloExcel(modulo)) return modulo;
  const padrao: unknown =
    typeof modulo === "object" && modulo !== null && "default" in modulo
      ? modulo.default
      : undefined;
  if (ehModuloExcel(padrao)) return padrao;
  throw new Error("Não foi possível carregar o gerador de planilha. Recarregue a página (F5).");
}

function nomeDaAba(titulo: string): string {
  return (
    titulo
      .replace(/[[\]:*?/\\]/g, " ")
      .trim()
      .slice(0, 31) || "Dados"
  );
}

function larguras(o: OpcoesExcel, marca: Marca): number[] {
  return o.colunas.map((coluna) => {
    if (coluna.largura) return coluna.largura;
    let maior = coluna.titulo.length + 2;
    for (const linha of o.linhas.slice(0, AMOSTRA_LARGURA)) {
      const valor = valorDaLinha(linha, coluna.chave);
      const texto = ehLinkSsw(valor)
        ? TEXTO_LINK_SSW
        : textoDaCelula(valor, coluna.formato, marca.fuso);
      maior = Math.max(maior, texto.length + 2);
    }
    return Math.min(Math.max(maior, LARGURA_MIN), LARGURA_MAX);
  });
}

function desenharTopo(ws: Worksheet, o: OpcoesExcel, marca: Marca, logoId: number | null): void {
  const suave = argb(CORES.textoSuave);
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 16;
  ws.getRow(3).height = 16;
  const titulo = ws.getCell(1, 2);
  titulo.value = o.titulo;
  titulo.font = { name: "Calibri", size: 15, bold: true, color: { argb: argb(marca.primaria) } };
  if (o.subtitulo) {
    const subtitulo = ws.getCell(2, 2);
    subtitulo.value = o.subtitulo;
    subtitulo.font = { name: "Calibri", size: 10, color: { argb: suave } };
  }
  const gerado = ws.getCell(3, 2);
  gerado.value = `${marca.nome} · ${SISTEMA} · gerado em ${dataHoraGeracao(marca.fuso)}`;
  gerado.font = { name: "Calibri", size: 9, color: { argb: suave } };
  if (logoId != null) {
    ws.addImage(logoId, {
      tl: { col: 0.1, row: 0.1 },
      ext: { width: 66, height: 66 },
      editAs: "oneCell",
    });
  }
  // Linha 4: faixa na cor principal com o acento de destaque sob o logo.
  ws.getRow(4).height = 5;
  for (let c = 1; c <= Math.max(o.colunas.length, 4); c++) {
    ws.getCell(4, c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: argb(c === 1 ? marca.destaque : marca.primaria) },
    };
  }
}

const LINHA_CABECALHO = 6;

function desenharTabela(ws: Worksheet, o: OpcoesExcel, marca: Marca): void {
  const primaria = argb(marca.primaria);
  const cabecalho = ws.getRow(LINHA_CABECALHO);
  cabecalho.values = o.colunas.map((c) => c.titulo);
  cabecalho.height = 20;
  cabecalho.eachCell((celula) => {
    celula.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: primaria } };
    celula.alignment = { vertical: "middle", wrapText: true };
    celula.border = { bottom: { style: "thin", color: { argb: primaria } } };
  });

  const borda = { style: "hair" as const, color: { argb: argb(CORES.linha) } };
  o.linhas.forEach((linha, i) => {
    const row = ws.getRow(LINHA_CABECALHO + 1 + i);
    o.colunas.forEach((coluna, j) => {
      const celula = row.getCell(j + 1);
      celula.border = { bottom: borda };
      const valor = valorDaLinha(linha, coluna.chave);
      // Link do CT-e no SSW: clicável, com texto curto no lugar da URL inteira.
      if (ehLinkSsw(valor)) {
        celula.value = { text: TEXTO_LINK_SSW, hyperlink: valor };
        celula.font = { name: "Calibri", size: 11, underline: true, color: { argb: primaria } };
        return;
      }
      const convertido = celulaExcel(valor, coluna.formato, marca.fuso);
      if (!convertido) return;
      celula.value = convertido.valor;
      if (convertido.formatoNumero) celula.numFmt = convertido.formatoNumero;
    });
  });

  ws.views = [{ state: "frozen", ySplit: LINHA_CABECALHO, showGridLines: false }];
  if (o.linhas.length > 0) {
    ws.autoFilter = {
      from: { row: LINHA_CABECALHO, column: 1 },
      to: { row: LINHA_CABECALHO + o.linhas.length, column: o.colunas.length },
    };
  }
}

/** Monta a planilha (sem baixar): separado para teste. */
export function montarPlanilha(
  ExcelJS: ModuloExcel,
  o: OpcoesExcel,
  logo: string | null,
): Workbook {
  const marca = resolverMarca(o.empresa);
  const wb = new ExcelJS.Workbook();
  wb.creator = `${marca.nome} — ${SISTEMA}`;
  wb.created = new Date();
  wb.title = o.titulo;
  const formato = logo ? formatoDoLogo(logo) : null;
  const logoId = logo && formato ? wb.addImage({ base64: logo, extension: formato }) : null;

  const ws = wb.addWorksheet(nomeDaAba(o.titulo));
  ws.columns = larguras(o, marca).map((width) => ({ width }));
  desenharTopo(ws, o, marca, logoId);
  desenharTabela(ws, o, marca);
  ws.pageSetup = {
    orientation: o.colunas.length > 8 ? "landscape" : "portrait",
    // A4. `PaperSize` é const enum só de tipo: com isolatedModules não dá para lê-lo.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-assignment
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${LINHA_CABECALHO}:${LINHA_CABECALHO}`,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.2, footer: 0.3 },
  };
  ws.headerFooter = { oddFooter: `&L&8${rodapeDaMarca(marca)}&R&8Página &P de &N` };
  return wb;
}

export async function exportarExcel(o: OpcoesExcel): Promise<void> {
  const [ExcelJS, logo] = await Promise.all([
    carregarExcelJs(),
    carregarLogo(resolverMarca(o.empresa).logoUrl),
  ]);
  const buffer = await montarPlanilha(ExcelJS, o, logo).xlsx.writeBuffer();
  baixarArquivo(new Blob([buffer], { type: MIME_XLSX }), nomeDoArquivo(o.arquivo, "xlsx"));
}
