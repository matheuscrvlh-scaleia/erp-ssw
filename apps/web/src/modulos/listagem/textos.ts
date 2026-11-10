/**
 * Textos da Listagem que têm regra (testados à parte).
 * origem: CtrcsTable.tsx, performance.lista.tsx e FiltrandoPor.tsx (sistema atual)
 */

const dias = (n: number) => `${n} ${n === 1 ? "dia" : "dias"}`;

export interface Selo {
  texto: string;
  tom: "ruim_forte" | "ruim" | "atencao" | "bom";
  dica?: string;
}

/**
 * Selo da coluna Atraso: atrasado (vermelho cheio em aberto, claro se já entregue), "Vence hoje"
 * (em aberto com atraso 0) ou "No prazo". Sem atraso calculado = sem selo.
 */
export function selo(atraso: number | null, entregue: boolean): Selo | null {
  if (atraso === null) return null;
  if (atraso > 0) {
    return entregue
      ? { texto: `Atrasado ${dias(atraso)}`, tom: "ruim", dica: "Entregue com atraso" }
      : { texto: `Atrasado ${dias(atraso)}`, tom: "ruim_forte" };
  }
  if (atraso === 0 && !entregue) return { texto: "Vence hoje", tom: "atencao" };
  return { texto: "No prazo", tom: "bom" };
}

const numero = (n: number) => n.toLocaleString("pt-BR");

/** "10 a 20 kg", "a partir de 10 kg", "até 20 kg" ou vazio. */
export function textoDaFaixa(min: number | null, max: number | null, unidade: string): string {
  if (min !== null && max !== null) return `${numero(min)} a ${numero(max)} ${unidade}`;
  if (min !== null) return `a partir de ${numero(min)} ${unidade}`;
  if (max !== null) return `até ${numero(max)} ${unidade}`;
  return "";
}
