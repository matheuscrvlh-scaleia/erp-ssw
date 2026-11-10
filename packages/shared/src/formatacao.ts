/**
 * Formatação pt-BR de todas as telas e exportações (um lugar só). Entradas vazias viram "—".
 * Cada tela passa as opções que reproduzem o que o sistema atual mostra nela.
 */
import { hojeNoFuso } from "./datas";

const TRACO = "—";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatarInteiro(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? TRACO : inteiro.format(valor);
}

export interface OpcoesPercentual {
  /** Casas decimais, sempre mostradas (padrão 1). */
  casas?: number;
  /** `"fracao"` (0,951) é o padrão; `"cem"` quando o valor já vem de 0 a 100 (95,1). */
  escala?: "fracao" | "cem";
  /**
   * `"."` só onde o sistema atual mostra ponto ("95.0%": cards e tabela por unidade da
   * Performance). O resto usa vírgula.
   */
  separador?: "," | ".";
}

/**
 * Percentual com arredondamento único (Intl) em tela, PDF, Excel e impressão:
 * `0.951` → `"95,1%"`; `{ escala: "cem" }` aceita `95.1`.
 */
export function formatarPercentual(
  valor: number | null | undefined,
  { casas = 1, escala = "fracao", separador = "," }: OpcoesPercentual = {},
): string {
  if (valor == null || !Number.isFinite(valor)) return TRACO;
  const texto = new Intl.NumberFormat(separador === "." ? "en-US" : "pt-BR", {
    style: escala === "fracao" ? "percent" : "decimal",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    useGrouping: separador === ",",
  }).format(valor);
  return escala === "fracao" ? texto : `${texto}%`;
}

/** Até `casas` decimais (padrão 2), sem zeros à direita: `1234.5` → `"1.234,5"`. */
export function formatarDecimal(valor: number | null | undefined, casas = 2): string {
  if (valor == null || !Number.isFinite(valor)) return TRACO;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: casas }).format(valor);
}

/** `"R$ 1.234,50"`; `{ centavos: false }` → `"R$ 1.235"` (cards e tabelas que somam frete). */
export function formatarMoeda(
  valor: number | null | undefined,
  { centavos = true }: { centavos?: boolean } = {},
): string {
  if (valor == null || !Number.isFinite(valor)) return TRACO;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    ...(centavos ? {} : { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  }).format(valor);
}

export interface OpcoesPeso {
  /** Casas em toneladas (de 1.000 kg para cima). Padrão 1. */
  tonelada?: number;
  /** Casas em quilos. Padrão 0. */
  quilo?: number;
  /** Mostra sempre as casas ("1,0 t"); sem isso, zeros à direita somem ("1 t"). */
  fixas?: boolean;
}

/**
 * Peso em kg, de 1.000 kg para cima em toneladas. Cada tela mantém as casas de hoje: Performance
 * `{}` ("1,5 t"), Romaneio `{ fixas: true }` ("1,0 t"), detalhe do CT-e
 * `{ tonelada: 3, quilo: 3, fixas: true }` ("1,250 t").
 */
export function formatarPeso(
  kg: number | null | undefined,
  { tonelada = 1, quilo = 0, fixas = false }: OpcoesPeso = {},
): string {
  if (kg == null || !Number.isFinite(kg)) return TRACO;
  const emToneladas = kg >= 1000;
  const casas = emToneladas ? tonelada : quilo;
  const texto = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fixas ? casas : 0,
    maximumFractionDigits: casas,
  }).format(emToneladas ? kg / 1000 : kg);
  return `${texto} ${emToneladas ? "t" : "kg"}`;
}

/** Diferença em pontos percentuais, com sinal: fração `0.023` → `"+2,3 pp"`. */
export function formatarPontos(fracao: number | null | undefined): string {
  if (fracao == null || !Number.isFinite(fracao)) return TRACO;
  const pontos = fracao * 100;
  const texto = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(pontos);
  return `${pontos > 0 ? "+" : ""}${texto} pp`;
}

/** Participação de `valor` em `total` ("12,5%"); sem total, "—". */
export function formatarParticipacao(valor: number, total: number): string {
  return total > 0 ? formatarPercentual(valor / total) : TRACO;
}

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;
const INSTANTE_COM_FUSO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}.*(Z|[+-]\d{2}(:?\d{2})?)$/;

/**
 * `"2026-11-10"` → `"10/11/2026"` (data de calendário não passa por Date: não tem fuso). Instante
 * com fuso (`"2026-11-10T02:00:00Z"`) vira o dia no fuso da empresa (Q11).
 */
export function formatarData(iso: string | null | undefined, fuso = "America/Sao_Paulo"): string {
  if (!iso) return TRACO;
  let dia = iso.slice(0, 10);
  if (!SO_DATA.test(iso) && INSTANTE_COM_FUSO.test(iso)) {
    const instante = new Date(iso);
    if (!Number.isNaN(instante.getTime())) dia = hojeNoFuso(fuso, instante);
  }
  const [ano, mes, d] = dia.split("-");
  return ano && mes && d ? `${d}/${mes}/${ano}` : TRACO;
}

/** `"2026-11-10"` → `"10/11"` (eixo de gráfico, tabela por dia). */
export function formatarDiaMes(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return mes && dia ? `${dia}/${mes}` : iso;
}

/**
 * Instante ISO → `"dd/mm/aaaa hh:mm"` no fuso da empresa. `virgula` mantém o
 * `"dd/mm/aaaa, hh:mm"` das telas que hoje mostram assim (ponto do Ahgora, Plataforma).
 */
export function formatarDataHora(
  iso: string | null | undefined,
  fuso = "America/Sao_Paulo",
  { virgula = false }: { virgula?: boolean } = {},
): string {
  if (!iso) return TRACO;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return TRACO;
  const texto = data.toLocaleString("pt-BR", {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return virgula ? texto : texto.replace(",", "");
}

/** Só dígitos → `00.000.000/0000-00`. */
export function formatarCnpj(valor: string): string {
  const d = valor.replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
