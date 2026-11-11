import { type TipoAnotacao } from "@erp/shared/contratos/historico";
import { Calendar, Cloud, type LucideIcon, MoreHorizontal, Settings2 } from "lucide-react";

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
