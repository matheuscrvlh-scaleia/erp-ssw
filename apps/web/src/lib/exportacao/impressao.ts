import { ErroDoOperador } from "@/lib/mensagem-de-erro";

import { dataHoraGeracao } from "./arquivo";
import { textoDaCelula, valorDaLinha } from "./celulas";
import { carregarLogo, CORES, type Marca, resolverMarca, SISTEMA } from "./marca";
import { ehLinkSsw } from "./ssw";
import { type OpcoesDocumentoImpresso, type OpcoesImpressao } from "./tipos";

/**
 * Impressão em HTML (iframe escondido + print()) com o mesmo cabeçalho do PDF: logo à esquerda,
 * título na cor principal, faixa com acento de destaque. A4, fonte 8 px, cabeçalho da tabela
 * repetido a cada página. origem: lista-export.ts / exportacao/html.ts (sistema atual).
 */

const ENTIDADES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => ENTIDADES[c] ?? c);
}

/**
 * CSS do cabeçalho com as cores da empresa. As cores ficam também em `--marca-primaria` e
 * `--marca-destaque`, para o CSS próprio de cada documento. origem: CSS_CABECALHO_FR
 */
function cssDoCabecalho(marca: Marca): string {
  return `
  :root { --marca-primaria: ${marca.primaria}; --marca-destaque: ${marca.destaque}; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cab { display: flex; align-items: center; gap: 10px; padding-bottom: 6px; margin-bottom: 8px;
    border-bottom: 1.5px solid ${marca.primaria}; position: relative; }
  .cab::after { content: ""; position: absolute; left: 0; bottom: -2px; width: 46px; height: 3px;
    background: ${marca.destaque}; }
  .cab img { width: 46px; height: 46px; object-fit: contain; flex: none; }
  .cab .tit { font-size: 13pt; font-weight: 700; color: ${marca.primaria}; line-height: 1.2; }
  .cab .sub { font-size: 8.5pt; color: ${CORES.textoSuave}; margin-top: 1px; }
  .cab .dir { margin-left: auto; text-align: right; font-size: 7.5pt; color: ${CORES.textoSuave};
    white-space: nowrap; }
  .cab .dir b { color: ${marca.primaria}; }`;
}

/** Cabeçalho (logo, título, subtítulo, `extraHtml` já escapado, "Gerado em"). origem: cabecalhoHtmlFr */
function htmlDoCabecalho(
  marca: Marca,
  logo: string | null,
  o: { titulo: string; subtitulo?: string | undefined; extraHtml?: string | undefined },
  agora: Date,
): string {
  return `<div class="cab">
    ${logo ? `<img src="${escaparHtml(logo)}" alt="${escaparHtml(marca.nome)}" />` : ""}
    <div>
      <div class="tit">${escaparHtml(o.titulo)}</div>
      ${o.subtitulo ? `<div class="sub">${escaparHtml(o.subtitulo)}</div>` : ""}
      ${o.extraHtml ?? ""}
    </div>
    <div class="dir"><b>${escaparHtml(`${marca.nome} · ${SISTEMA}`)}</b><br />Gerado em ${escaparHtml(dataHoraGeracao(marca.fuso, agora))}</div>
  </div>`;
}

/** Documento HTML completo da impressão (sem efeito colateral: testável). */
export function montarHtmlImpressao(
  o: OpcoesImpressao,
  logo: string | null,
  agora: Date = new Date(),
): string {
  const marca = resolverMarca(o.empresa);
  const tamanhoPagina = o.orientacao === "paisagem" ? "A4 landscape" : "A4 portrait";
  const cabecalhoTabela = o.colunas.map((c) => `<th>${escaparHtml(c.titulo)}</th>`).join("");
  const corpo = o.linhas
    .map((linha) => {
      const celulas = o.colunas.map((coluna) => {
        const valor = valorDaLinha(linha, coluna.chave);
        // A URL do SSW vira um link curto (clicável no PDF salvo pelo navegador).
        return ehLinkSsw(valor)
          ? `<td class="ssw"><a href="${escaparHtml(valor)}" target="_blank" rel="noopener">SSW</a></td>`
          : `<td>${escaparHtml(textoDaCelula(valor, coluna.formato, marca.fuso))}</td>`;
      });
      return `<tr>${celulas.join("")}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><title>${escaparHtml(o.titulo)}</title>
<style>
  @page { size: ${tamanhoPagina}; margin: 10mm; }
  body { font: 8px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; margin: 0; }
${cssDoCabecalho(marca)}
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 2px 3px; text-align: left; vertical-align: top; word-break: break-word; }
  th { background: ${marca.primaria}; color: #fff; font-weight: 600; }
  thead { display: table-header-group; }
  tbody tr:nth-child(even) td { background: ${CORES.zebra}; }
  td.ssw { white-space: nowrap; }
  td.ssw a { color: ${marca.primaria}; font-weight: 600; }
</style></head>
<body>
  ${htmlDoCabecalho(marca, logo, o, agora)}
  <table>
    <thead><tr>${cabecalhoTabela}</tr></thead>
    <tbody>${corpo}</tbody>
  </table>
</body></html>`;
}

/**
 * Documento de layout próprio (ex.: relatório de período, com cards e várias tabelas) com o
 * cabeçalho da empresa. `estilos` e `corpoHtml` vêm prontos (texto do dado já escapado).
 */
export function montarDocumentoImpresso(
  o: OpcoesDocumentoImpresso,
  logo: string | null,
  agora: Date = new Date(),
): string {
  const marca = resolverMarca(o.empresa);
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
<title>${escaparHtml(o.tituloDaJanela)}</title>
<style>
${cssDoCabecalho(marca)}
${o.estilos}
</style></head><body>
  ${htmlDoCabecalho(marca, logo, o, agora)}
  ${o.corpoHtml}
</body></html>`;
}

/** Abre a janela de impressão do navegador com o documento num iframe escondido. */
async function imprimirHtml(html: string): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "-10000px",
    width: "0",
    height: "0",
    border: "0",
  });
  const carregado = new Promise((resolve) => {
    iframe.addEventListener("load", resolve, { once: true });
  });
  iframe.srcdoc = html;
  document.body.appendChild(iframe);
  await carregado;
  const janela = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!janela || !doc) {
    iframe.remove();
    throw new ErroDoOperador("O navegador bloqueou a impressão. Tente de novo.");
  }
  // Espera o logo decodificar e o layout assentar antes de abrir a janela de impressão.
  await Promise.all(Array.from(doc.images).map((img) => img.decode().catch(() => undefined)));
  await new Promise((resolve) => setTimeout(resolve, 200));
  janela.addEventListener("afterprint", () => {
    iframe.remove();
  });
  janela.focus();
  janela.print();
  // Navegador que não dispara "afterprint" não deixa o iframe para trás.
  setTimeout(() => {
    iframe.remove();
  }, 60_000);
}

export async function imprimir(o: OpcoesImpressao): Promise<void> {
  const logo = await carregarLogo(resolverMarca(o.empresa).logoUrl);
  await imprimirHtml(montarHtmlImpressao(o, logo));
}

export async function imprimirDocumento(o: OpcoesDocumentoImpresso): Promise<void> {
  const logo = await carregarLogo(resolverMarca(o.empresa).logoUrl);
  await imprimirHtml(montarDocumentoImpresso(o, logo));
}
