import { FUSO_PADRAO } from "./celulas";
import { type EmpresaExportacao } from "./tipos";

/**
 * Identidade visual da empresa em todo arquivo exportado (PDF, Excel, impressão).
 * origem: src/lib/exportacao/marca.ts (sistema atual). Para a FR os valores do cadastro são os de
 * sempre (#212a63, #c0392b, "FR Transportes", "Logística e Locações" e o mesmo logo), então o
 * arquivo sai idêntico ao de hoje. Cor inválida cai na cor do tema; sem logo, sai sem logo.
 */

export const SISTEMA = "Painel BI";

/** Cores fixas do desenho (texto, linhas e zebra), iguais para toda empresa. */
export const CORES = {
  texto: "#1f2421",
  textoSuave: "#6b736e",
  linha: "#e1e4eb",
  zebra: "#f4f5fa",
} as const;

const PRIMARIA_PADRAO = "#212a63";
const DESTAQUE_PADRAO = "#c0392b";
const COR = /^#[0-9a-fA-F]{6}$/;

export interface Marca {
  nome: string;
  slogan: string;
  /** Cor principal: título, faixa e cabeçalho da tabela. */
  primaria: string;
  /** Cor de destaque: acento sob o logo. */
  destaque: string;
  logoUrl: string | null;
  fuso: string;
}

export function resolverMarca(empresa: EmpresaExportacao): Marca {
  const cor = (valor: string | undefined, padrao: string) =>
    valor && COR.test(valor) ? valor : padrao;
  return {
    nome: empresa.nome,
    slogan: empresa.slogan ?? "",
    primaria: cor(empresa.corPrimaria, PRIMARIA_PADRAO),
    destaque: cor(empresa.corDestaque, DESTAQUE_PADRAO),
    logoUrl: empresa.logoUrl ?? null,
    fuso: empresa.fuso ?? FUSO_PADRAO,
  };
}

/** "Nome — Slogan" do rodapé (só o nome quando a empresa não tem slogan). */
export function rodapeDaMarca(marca: Marca): string {
  return marca.slogan ? `${marca.nome} — ${marca.slogan}` : marca.nome;
}

type Rgb = [number, number, number];

export function hexParaRgb(hex: string): Rgb {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** jsPDF e exceljs só desenham PNG e JPEG; outro formato de logo fica de fora. */
export function formatoDoLogo(dataUrl: string): "png" | "jpeg" | null {
  if (dataUrl.startsWith("data:image/png")) return "png";
  if (dataUrl.startsWith("data:image/jpeg") || dataUrl.startsWith("data:image/jpg")) return "jpeg";
  return null;
}

function lerComoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      resolve(typeof leitor.result === "string" ? leitor.result : "");
    };
    leitor.onerror = () => {
      reject(leitor.error ?? new Error("Falha ao ler o logo."));
    };
    leitor.readAsDataURL(blob);
  });
}

const logos = new Map<string, Promise<string | null>>();

/**
 * Logo como data URL, baixado uma vez por endereço. Falhou ou não é PNG/JPEG: devolve null e o
 * arquivo sai sem logo — a exportação nunca trava por causa do logo.
 */
export function carregarLogo(url: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  const emCache = logos.get(url);
  if (emCache) return emCache;
  const carregando = fetch(url)
    .then((resposta) => {
      if (!resposta.ok) throw new Error(`logo ${resposta.status}`);
      return resposta.blob();
    })
    .then(lerComoDataUrl)
    .then((dataUrl) => (formatoDoLogo(dataUrl) ? dataUrl : null))
    .catch((erro: unknown) => {
      console.warn("[exportacao] logo da empresa indisponível", erro);
      logos.delete(url);
      return null;
    });
  logos.set(url, carregando);
  return carregando;
}
