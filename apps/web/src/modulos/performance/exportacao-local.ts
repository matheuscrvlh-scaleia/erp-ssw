/*
 * TODO(kit-ui): trocar por @/lib/exportacao (exportarExcel/Pdf/Csv, imprimir) quando o kit chegar
 * à main. Mesma assinatura do kit, para a troca ser só o import.
 */

export interface ColunaExportada<L> {
  chave: keyof L & string;
  titulo: string;
}

export interface Exportacao<L> {
  arquivo: string;
  titulo: string;
  subtitulo?: string;
  colunas: ColunaExportada<L>[];
  linhas: readonly L[];
  empresa: string;
}

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto =
    typeof valor === "number"
      ? String(valor).replace(".", ",")
      : typeof valor === "string"
        ? valor
        : JSON.stringify(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** CSV com `;` e BOM (abre direto no Excel em português). */
export function montarCsv<L>(e: Pick<Exportacao<L>, "colunas" | "linhas">): string {
  const cabecalho = e.colunas.map((c) => celula(c.titulo)).join(";");
  const corpo = e.linhas.map((l) => e.colunas.map((c) => celula(l[c.chave])).join(";"));
  return `﻿${[cabecalho, ...corpo].join("\r\n")}`;
}

export function exportarCsv<L>(e: Exportacao<L>): void {
  const blob = new Blob([montarCsv(e)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.arquivo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Abre a tabela numa janela de impressão (o usuário salva em PDF pelo navegador). */
export function imprimir<L>(e: Exportacao<L>): void {
  const janela = window.open("", "_blank");
  if (!janela) return;
  const cab = e.colunas.map((c) => `<th>${escapar(c.titulo)}</th>`).join("");
  const corpo = e.linhas
    .map(
      (l) =>
        `<tr>${e.colunas.map((c) => `<td>${escapar(celula(l[c.chave]).replace(/^"|"$/g, ""))}</td>`).join("")}</tr>`,
    )
    .join("");
  janela.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapar(e.titulo)}</title>` +
      `<style>body{font:12px system-ui;margin:24px}table{border-collapse:collapse;width:100%}` +
      `th,td{border:1px solid #ddd;padding:4px 6px;text-align:left}th{background:#f4f4f4}</style>` +
      `</head><body><h2>${escapar(e.empresa)} — ${escapar(e.titulo)}</h2>` +
      (e.subtitulo ? `<p>${escapar(e.subtitulo)}</p>` : "") +
      `<table><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table></body></html>`,
  );
  janela.document.close();
  janela.print();
}
