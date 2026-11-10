/** Formatação das telas do Romaneio (mesmas casas e unidades de hoje). */
export const nfInt = new Intl.NumberFormat("pt-BR");
const nfTon = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export const nfPct = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
/** % Performance das abas Motorista e Ajudante: duas casas (709 levados, 2 prejudicados = 99,72%). */
export const nfPct2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const nfMoedaInteira = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

/** Acima de 1.000 kg em toneladas. */
export function fmtPeso(kg: number | null): string {
  if (kg == null) return "—";
  return kg >= 1000 ? `${nfTon.format(kg / 1000)} t` : `${nfInt.format(Math.round(kg))} kg`;
}

export const fmtMoeda = (v: number | null) => (v == null ? "—" : nfMoeda.format(v));
/** Moeda sem centavos (cards e tabelas das abas). */
export const fmtMoedaInteira = (v: number) => nfMoedaInteira.format(v);

/** Percentual de 0 a 100 com uma casa ("95,1%"). */
export const fmtPct = (v: number | null) => (v == null ? "—" : `${nfPct.format(v)}%`);

/** "AAAA-MM-DD" → "dd/mm". */
export function fmtDiaCurto(dia: string): string {
  const [, m, d] = dia.split("-");
  return m && d ? `${d}/${m}` : dia;
}

/** Instante ISO → "dd/mm/aa hh:mm" (horário de Brasília). */
export function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}
