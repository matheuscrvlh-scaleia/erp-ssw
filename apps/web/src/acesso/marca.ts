import { type EmpresaAtiva } from "@erp/shared/contratos/auth";
import { useEffect } from "react";

/** Padrão de `empresas.cor_primaria` (e cor do login antes de saber a empresa). */
export const COR_PADRAO = "#212a63";

const TITULO_PADRAO = "Painel Logístico";
const CHAVE_DA_ULTIMA_COR = "marca:ultima-cor";
const QUASE_PRETO = "#0b0f14";
const BRANCO = "#ffffff";
const HEX = /^#[0-9a-f]{6}$/;

type Rgb = readonly [number, number, number];

function paraRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function paraHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Mistura `a` com `b` (fração de `b`). */
function misturar(a: string, b: string, fracaoDeB: number): string {
  const [ar, ag, ab] = paraRgb(a);
  const [br, bg, bb] = paraRgb(b);
  const m = (x: number, y: number) => x * (1 - fracaoDeB) + y * fracaoDeB;
  return paraHex([m(ar, br), m(ag, bg), m(ab, bb)]);
}

const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Luminância relativa (WCAG 2.x). */
function luminancia(hex: string): number {
  const [r, g, b] = paraRgb(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contraste(a: string, b: string): number {
  const la = luminancia(a);
  const lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Vai misturando com `alvo` em passos de 4% até o contraste com `fundo` chegar a `minimo`. */
function ajustarAte(cor: string, alvo: string, fundo: string, minimo: number): string {
  for (let f = 0; f <= 1; f += 0.04) {
    const tentativa = misturar(cor, alvo, f);
    if (contraste(tentativa, fundo) >= minimo) return tentativa;
  }
  return alvo;
}

function paraHsl(hex: string): readonly [number, number, number] {
  const [r, g, b] = paraRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function deHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return paraHex([(r + m) * 255, (g + m) * 255, (b + m) * 255]);
}

/**
 * Tom claro e vivo da mesma cor (mesmo matiz, saturação de pelo menos 55%), clareando até dar
 * `minimo` de contraste com `fundo`. Misturar com branco deixaria o tom acinzentado.
 */
function tomClaro(cor: string, fundo: string, minimo: number, lInicial: number): string {
  const [h, s] = paraHsl(cor);
  const saturacao = s < 0.08 ? s : Math.max(s, 0.55);
  for (let l = lInicial; l <= 0.97; l += 0.02) {
    const tentativa = deHsl(h, saturacao, l);
    if (contraste(tentativa, fundo) >= minimo) return tentativa;
  }
  return BRANCO;
}

/** Texto sobre a cor: branco ou quase preto, o que der mais contraste. */
const textoSobre = (cor: string) =>
  contraste(cor, BRANCO) >= contraste(cor, QUASE_PRETO) ? BRANCO : QUASE_PRETO;

/**
 * Paleta inteira derivada de UMA cor da empresa, com contraste WCAG AA garantido:
 * - `--marca`: botões e destaques no tema claro (escurecida se não der 3:1 sobre o branco);
 * - `--marca-texto`: a cor usada como texto/link sobre fundo claro (4,5:1);
 * - `--marca-clara`: a versão do tema escuro (clareada até 4,5:1 sobre o fundo escuro);
 * - `--lateral`: fundo da barra lateral (tom bem escuro da cor) e `--lateral-destaque`, o tom
 *   claro do item ativo sobre ela (4,5:1);
 * - `*-fg`: texto sobre cada uma (branco ou quase preto).
 */
export function paletaDaMarca(corPrimaria: string | undefined): Record<string, string> {
  const cor = corPrimaria?.toLowerCase();
  const base = cor && HEX.test(cor) ? cor : COR_PADRAO;
  const marca = ajustarAte(base, QUASE_PRETO, BRANCO, 3);
  const marcaTexto = ajustarAte(base, QUASE_PRETO, BRANCO, 4.5);
  const marcaClara = tomClaro(base, "#0f141b", 5, 0.5);
  // Lateral: a cor bem escura (como o verde-musgo do mockup), nunca clara a ponto de apagar o texto.
  let lateral = misturar(base, "#05070a", 0.55);
  if (contraste(lateral, BRANCO) < 10) lateral = ajustarAte(lateral, "#05070a", BRANCO, 10);
  const lateralDestaque = tomClaro(base, lateral, 6, 0.62);
  return {
    "--marca": marca,
    "--marca-fg": textoSobre(marca),
    "--marca-texto": marcaTexto,
    "--marca-clara": marcaClara,
    "--marca-clara-fg": textoSobre(marcaClara),
    "--lateral": lateral,
    "--lateral-destaque": lateralDestaque,
  };
}

export function tituloComEmpresa(nomeEmpresa: string | undefined): string {
  return nomeEmpresa ? `${nomeEmpresa} · ${TITULO_PADRAO}` : TITULO_PADRAO;
}

/** Última cor de empresa vista neste navegador: o login abre com ela (conveniência, não regra). */
export function ultimaCorDaMarca(): string | undefined {
  try {
    return window.localStorage.getItem(CHAVE_DA_ULTIMA_COR) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Aplica a paleta no `<html>`; devolve a limpeza. */
export function aplicarPaleta(cor: string | undefined): () => void {
  const raiz = document.documentElement.style;
  const variaveis = Object.entries(paletaDaMarca(cor));
  for (const [nome, valor] of variaveis) raiz.setProperty(nome, valor);
  return () => {
    for (const [nome] of variaveis) raiz.removeProperty(nome);
  };
}

/** Cores (barra lateral, botões, gráficos) e título da aba conforme a empresa ativa. */
export function useMarcaDaEmpresa(empresa: EmpresaAtiva | null): void {
  const cor = empresa?.corPrimaria;
  const nome = empresa?.nome;
  useEffect(() => {
    if (cor) {
      try {
        window.localStorage.setItem(CHAVE_DA_ULTIMA_COR, cor);
      } catch {
        // navegador sem storage: o login volta à cor padrão
      }
    }
    return aplicarPaleta(cor);
  }, [cor]);
  useEffect(() => {
    document.title = tituloComEmpresa(nome);
    return () => {
      document.title = TITULO_PADRAO;
    };
  }, [nome]);
}
