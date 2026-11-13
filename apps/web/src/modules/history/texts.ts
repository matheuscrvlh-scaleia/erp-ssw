import { type TipoAnotacao } from "@erp/shared/contracts/history";
import { Calendar, Cloud, type LucideIcon, MoreHorizontal, Settings2 } from "lucide-react";

import { type PeriodoDoHistorico, type Presenca } from "./search";

export const ROTULO_DO_PERIODO: Record<PeriodoDoHistorico, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  mes: "Mês",
  "90d": "90 dias",
};

export const ROTULO_DA_PRESENCA: Record<Presenca, string> = {
  todos: "Todos os dias",
  anotacao: "Só com anotação",
  feriado: "Só com feriado",
  ambos: "Com ambos",
};

export const ICONE_DO_TIPO: Record<TipoAnotacao, LucideIcon> = {
  clima: Cloud,
  operacional: Settings2,
  feriado: Calendar,
  outro: MoreHorizontal,
};

/**
 * Cor de cada tipo de anotação (categoria, não situação): `icone` pinta o quadrado do ícone,
 * `ponto` o marcador sólido (calendário, filtros).
 */
export const COR_DO_TIPO: Record<TipoAnotacao, { icone: string; ponto: string }> = {
  clima: { icone: "bg-serie-1/12 text-serie-1", ponto: "bg-serie-1" },
  operacional: { icone: "bg-serie-7/12 text-serie-7", ponto: "bg-serie-7" },
  feriado: { icone: "bg-serie-4/15 text-serie-4", ponto: "bg-serie-4" },
  outro: { icone: "bg-muted text-muted-foreground", ponto: "bg-muted-foreground" },
};

/** Título do dia na linha do tempo ("quinta-feira, 05 de novembro"). */
export function diaPorExtenso(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date(`${iso}T00:00:00Z`));
}
