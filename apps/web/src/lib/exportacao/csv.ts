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

export function exportarCsv({ arquivo, colunas, linhas, fuso }: OpcoesCsv): void {
  const texto = montarCsv(colunas, linhas, fuso);
  baixarArquivo(
    new Blob([BOM + texto], { type: "text/csv;charset=utf-8;" }),
    nomeDoArquivo(arquivo, "csv"),
  );
}
