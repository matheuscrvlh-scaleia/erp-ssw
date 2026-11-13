/**
 * Exportação com a identidade visual da empresa ativa. Todo arquivo que sai do painel passa por
 * aqui (não monte jsPDF/planilha à mão):
 * - `exportarExcel` — logo e título no topo, cabeçalho na cor da empresa com filtro e congelado;
 * - `exportarPdf`   — logo, título, faixa, tabela zebrada, "Página X de Y";
 * - `imprimir`      — mesmo cabeçalho do PDF, pela janela de impressão do navegador
 *   (`imprimirDocumento` para layout próprio, como o relatório de período);
 * - `exportarCsv`   — só os dados (para reimportar), de propósito sem marca
 *   (`exportarCsvEmSecoes` para várias tabelas num arquivo só).
 * jsPDF e exceljs só são baixados no clique (import dinâmico). Ver docs/kit-ui.md.
 */
export { textoDaCelula } from "./cells";
export { exportarCsv, exportarCsvEmSecoes, type LinhaCsvEmSecoes } from "./csv";
export { exportarExcel } from "./excel";
export { nomeDoArquivo, sufixoHoje } from "./file";
export { exportarPdf } from "./pdf";
export { escaparHtml, imprimir, imprimirDocumento } from "./print";
export { COLUNA_LINK_SSW, TEXTO_LINK_SSW, urlCtrcNoSsw } from "./ssw";
export type {
  AbaExcel,
  ColunaExportacao,
  EmpresaExportacao,
  FormatoColuna,
  LinhaExportacao,
  OpcoesCsv,
  OpcoesDocumentoImpresso,
  OpcoesExcel,
  OpcoesImpressao,
  OpcoesPdf,
  Orientacao,
} from "./types";
