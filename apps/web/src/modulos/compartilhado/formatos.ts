import { textoDaCelula } from "@/lib/exportacao";

/** Formatação das telas: a mesma da exportação (pt-BR), com "—" no vazio. */
const ou = (texto: string) => texto || "—";

export const inteiro = (n: number) => textoDaCelula(n, "inteiro");
export const decimal = (n: number | null) => ou(textoDaCelula(n, "decimal"));
export const moeda = (n: number | null) => ou(textoDaCelula(n, "moeda"));
/** `fracao` 0,951 → "95,1%". */
export const percentual = (fracao: number) => textoDaCelula(fracao, "percentual");
/** "AAAA-MM-DD" (ou instante: dia de Brasília) → "dd/mm/aaaa". */
export const data = (iso: string | null, fuso?: string) => ou(textoDaCelula(iso, "data", fuso));
export const dataHora = (iso: string | null, fuso?: string) =>
  ou(textoDaCelula(iso, "datahora", fuso));

/** Participação de `valor` em `total`; sem total, "—". */
export function participacao(valor: number, total: number): string {
  return total > 0 ? percentual(valor / total) : "—";
}

/** "AAAA-MM-DD" → "dd/mm". */
export function diaMes(iso: string): string {
  const [, m, d] = iso.split("-");
  return m && d ? `${d}/${m}` : iso;
}
