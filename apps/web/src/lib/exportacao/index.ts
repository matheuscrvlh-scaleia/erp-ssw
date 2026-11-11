/**
 * Exportação com a identidade visual da empresa ativa. Todo arquivo que sai do painel passa por
 * aqui (não monte jsPDF/planilha à mão):
 * - `exportarExcel` — logo e título no topo, cabeçalho na cor da empresa com filtro e congelado;
 * - `exportarPdf`   — logo, título, faixa, tabela zebrada, "Página X de Y";
 * - `imprimir`      — mesmo cabeçalho do PDF, pela janela de impressão do navegador;
 * - `exportarCsv`   — só os dados (para reimportar), de propósito sem marca.
 * jsPDF e exceljs só são baixados no clique (import dinâmico). Ver docs/kit-ui.md.
 */
export { nomeDoArquivo, sufixoHoje } from "./arquivo";
export { textoDaCelula } from "./celulas";
export { exportarCsv } from "./csv";
export { exportarExcel } from "./excel";
export { imprimir } from "./impressao";
export { exportarPdf } from "./pdf";
export { COLUNA_LINK_SSW, TEXTO_LINK_SSW, urlCtrcNoSsw } from "./ssw";
export type {
  AbaExcel,
  ColunaExportacao,
  EmpresaExportacao,
  FormatoColuna,
  LinhaExportacao,
  OpcoesCsv,
  OpcoesExcel,
  OpcoesImpressao,
  OpcoesPdf,
  Orientacao,
} from "./tipos";
