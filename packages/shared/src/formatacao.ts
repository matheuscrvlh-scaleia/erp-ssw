/** Formatação pt-BR usada nas telas e exportações. Entradas vazias viram "—". */
const TRACO = "—";

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatarInteiro(valor: number | null | undefined): string {
  return valor == null || !Number.isFinite(valor) ? TRACO : inteiro.format(valor);
}

/** `0.951` → `"95,1%"`. */
export function formatarPercentual(fracao: number | null | undefined, casas = 1): string {
  if (fracao == null || !Number.isFinite(fracao)) return TRACO;
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(fracao);
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null || !Number.isFinite(valor)) return TRACO;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

/** `"2026-11-10"` → `"10/11/2026"` (sem passar por Date: data de calendário não tem fuso). */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return TRACO;
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : TRACO;
}

/** Instante ISO → `"dd/mm/aaaa hh:mm"` no fuso da empresa. */
export function formatarDataHora(
  iso: string | null | undefined,
  fuso = "America/Sao_Paulo",
): string {
  if (!iso) return TRACO;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return TRACO;
  return data
    .toLocaleString("pt-BR", {
      timeZone: fuso,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");
}

/** Só dígitos → `00.000.000/0000-00`. */
export function formatarCnpj(valor: string): string {
  const d = valor.replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}
