/**
 * Exportação mínima (CSV e impressão) até a biblioteca da empresa chegar na main.
 * TODO(kit-ui): trocar por `exportarCsv`/`exportarExcel`/`exportarPdf`/`imprimir` de
 * `@/lib/exportacao` (marca da empresa, Excel e PDF) e apagar este arquivo.
 */
import { formatarData, formatarDataHora } from "@erp/shared/formatacao";

import { type ColunaExportacao, type LinhaExportada } from "./exportacao";

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const moeda = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function textoDaCelula(linha: LinhaExportada, coluna: ColunaExportacao): string {
  const valor = linha[coluna.chave];
  if (valor === null || valor === "") return "";
  if (typeof valor === "number") {
    if (coluna.formato === "decimal") return decimal.format(valor);
    if (coluna.formato === "moeda") return moeda.format(valor);
    return String(valor);
  }
  if (coluna.formato === "data") return formatarData(valor);
  if (coluna.formato === "datahora") return formatarDataHora(valor);
  return valor;
}

function celulaCsv(texto: string): string {
  return /[";,\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV com `;`, BOM (o Excel abre acentuado) e aspas quando precisa; números crus, como hoje. */
export function montarCsv(
  colunas: readonly ColunaExportacao[],
  linhas: readonly LinhaExportada[],
): string {
  const celula = (l: LinhaExportada, c: ColunaExportacao) => {
    const valor = l[c.chave];
    return typeof valor === "number" ? String(valor) : textoDaCelula(l, c);
  };
  const cabecalho = colunas.map((c) => celulaCsv(c.titulo)).join(";");
  const corpo = linhas.map((l) => colunas.map((c) => celulaCsv(celula(l, c))).join(";"));
  return `\uFEFF${[cabecalho, ...corpo].join("\r\n")}`;
}

export function baixarCsv(arquivo: string, conteudo: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${arquivo}.csv`;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

const escapar = (texto: string) =>
  texto.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );

/** Impressão A4 retrato (o navegador também salva em PDF). O link do SSW vira "SSW". */
export function imprimirTabela(
  titulo: string,
  subtitulo: string,
  colunas: readonly ColunaExportacao[],
  linhas: readonly LinhaExportada[],
): void {
  const cabecalho = colunas.map((c) => `<th>${escapar(c.titulo)}</th>`).join("");
  const corpo = linhas
    .map(
      (l) =>
        `<tr>${colunas
          .map((c) => {
            const texto = textoDaCelula(l, c);
            return c.chave === "linkSsw" && texto
              ? `<td><a href="${escapar(texto)}">SSW</a></td>`
              : `<td>${escapar(texto)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("");
  const moldura = document.createElement("iframe");
  moldura.style.cssText = "position:fixed;right:-10000px;width:0;height:0;border:0";
  moldura.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>@page{size:A4 portrait;margin:10mm}body{font:8px/1.3 sans-serif;color:#111}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:2px 3px;text-align:left;vertical-align:top}
th{background:#212a63;color:#fff}thead{display:table-header-group}</style></head>
<body><h1 style="font-size:13px;margin:0">${escapar(titulo)}</h1><p style="margin:2px 0 8px">${escapar(subtitulo)}</p>
<table><thead><tr>${cabecalho}</tr></thead><tbody>${corpo}</tbody></table></body></html>`;
  moldura.onload = () => {
    moldura.contentWindow?.focus();
    moldura.contentWindow?.print();
    setTimeout(() => {
      moldura.remove();
    }, 1000);
  };
  document.body.appendChild(moldura);
}
