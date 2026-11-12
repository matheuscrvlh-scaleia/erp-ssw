import { type TipoFeriado } from "@erp/shared/contratos/calendario";

/**
 * Cor de cada tipo de feriado (categoria, não situação): fundo leve e borda da série do gráfico,
 * texto no tom principal para manter o contraste nos dois temas.
 */
export function corDoTipo(tipo: TipoFeriado): string {
  if (tipo === "nacional") return "border-serie-2/45 bg-serie-2/12 text-foreground";
  if (tipo === "municipal") return "border-serie-4/50 bg-serie-4/14 text-foreground";
  return "border-serie-1/45 bg-serie-1/12 text-foreground";
}

/** Ponto sólido do tipo (legenda, miniatura do ano). */
export const PONTO_DO_TIPO: Record<TipoFeriado, string> = {
  nacional: "bg-serie-2",
  estadual: "bg-serie-1",
  municipal: "bg-serie-4",
};
