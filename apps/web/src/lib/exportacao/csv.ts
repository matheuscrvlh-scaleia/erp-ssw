import { baixarArquivo, nomeDoArquivo } from "./arquivo";
import { FUSO_PADRAO, paraNumero, textoCsv, valorDaLinha } from "./celulas";
import { type ColunaExportacao, type LinhaExportacao, type OpcoesCsv } from "./tipos";

/**
 * CSV fica só com os dados, de propósito: é o formato para reimportar em outro sistema ou
 * planilha, e qualquer linha de logo ou título quebraria essa leitura. A identidade visual vai no
 * Excel e no PDF. Separador ";" e BOM UTF-8: o Excel em português abre com acentos certos.
 */

/** Marca de ordem de bytes: sem ela o Excel lê o arquivo como Latin-1 e estraga os acentos. */
const BOM = String.fromCharCode(0xfeff);

/** Início que o Excel/LibreOffice leem como fórmula (injeção de fórmula/DDE). */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/;
const FORMATOS_NUMERICOS = new Set(["inteiro", "decimal", "moeda", "percentual"]);

/**
 * Texto vindo do dado (nome de cliente, observação…) que começa com = + - @, tab ou CR sai com
 * `'` na frente, para a planilha mostrar como texto. Número formatado não muda.
 */
function semFormula(valor: unknown, formato: string | undefined, texto: string): string {
  const numero = FORMATOS_NUMERICOS.has(formato ?? "") && paraNumero(valor) !== null;
  return !numero && INICIO_DE_FORMULA.test(texto) ? `'${texto}` : texto;
}

function campo(texto: string): string {
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function montarCsv(
  colunas: readonly ColunaExportacao[],
  linhas: readonly LinhaExportacao[],
  fuso = FUSO_PADRAO,
): string {
  const cabecalho = colunas.map((c) => campo(c.titulo)).join(";");
  const corpo = linhas.map((linha) =>
    colunas
      .map((c) => {
        const valor = valorDaLinha(linha, c.chave);
        return campo(semFormula(valor, c.formato, textoCsv(valor, c.formato, fuso)));
      })
      .join(";"),
  );
  return [cabecalho, ...corpo].join("\n");
}

function baixarCsv(arquivo: string, texto: string): void {
  baixarArquivo(
    new Blob([BOM + texto], { type: "text/csv;charset=utf-8;" }),
    nomeDoArquivo(arquivo, "csv"),
  );
}

export function exportarCsv({ arquivo, colunas, linhas, fuso }: OpcoesCsv): void {
  baixarCsv(arquivo, montarCsv(colunas, linhas, fuso));
}

/** Linha do CSV em seções: texto cru (título `# ...` ou linha em branco) ou as células. */
export type LinhaCsvEmSecoes = string | readonly (string | number)[];

/** Número já formatado com vírgula ("95,73", "-1,50"): não leva `'` (número não muda). */
const NUMERO_EM_TEXTO = /^-?\d+(,\d+)?$/;

/** Célula do CSV em seções: aspas também com vírgula, como o relatório de período de hoje. */
function celulaEmSecao(valor: string | number): string {
  const texto =
    typeof valor === "number" || NUMERO_EM_TEXTO.test(valor) || !INICIO_DE_FORMULA.test(valor)
      ? String(valor)
      : `'${valor}`;
  return /[";\n\r,]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * CSV com várias tabelas uma depois da outra, separadas por títulos `# ...` (relatório de
 * período). origem: exportCsv (RelatorioPeriodoPanel.tsx, sistema atual)
 */
export function montarCsvEmSecoes(linhas: readonly LinhaCsvEmSecoes[]): string {
  return linhas.map((l) => (typeof l === "string" ? l : l.map(celulaEmSecao).join(";"))).join("\n");
}

export function exportarCsvEmSecoes(arquivo: string, linhas: readonly LinhaCsvEmSecoes[]): void {
  baixarCsv(arquivo, montarCsvEmSecoes(linhas));
}
