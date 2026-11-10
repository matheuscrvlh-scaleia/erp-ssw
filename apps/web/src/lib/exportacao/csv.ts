import { baixarArquivo, nomeDoArquivo } from "./arquivo";
import { FUSO_PADRAO, textoCsv, valorDaLinha } from "./celulas";
import { type ColunaExportacao, type LinhaExportacao, type OpcoesCsv } from "./tipos";

/**
 * CSV fica só com os dados, de propósito: é o formato para reimportar em outro sistema ou
 * planilha, e qualquer linha de logo ou título quebraria essa leitura. A identidade visual vai no
 * Excel e no PDF. Separador ";" e BOM UTF-8: o Excel em português abre com acentos certos.
 */

/** Marca de ordem de bytes: sem ela o Excel lê o arquivo como Latin-1 e estraga os acentos. */
const BOM = String.fromCharCode(0xfeff);

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
    colunas.map((c) => campo(textoCsv(valorDaLinha(linha, c.chave), c.formato, fuso))).join(";"),
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
