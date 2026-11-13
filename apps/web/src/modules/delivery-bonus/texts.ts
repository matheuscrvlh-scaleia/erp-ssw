import { type LinhaBonificacao } from "@erp/domain/delivery-bonus";
import { CircleX, Gauge, type LucideIcon, Truck, Zap } from "lucide-react";

import { type Tom } from "@/components/common/StatusBadge";

import { TODAS } from "./rules";

type Nivel = LinhaBonificacao["nivel"];

/** Nome, tom do selo e ícone de cada nível (tabela da apuração e "Como funciona"). */
export const NIVEL: Record<Nivel, { rotulo: string; tom: Tom; icone: LucideIcon }> = {
  turbo: { rotulo: "Turbo", tom: "sucesso", icone: Zap },
  acelerado: { rotulo: "Acelerado", tom: "info", icone: Gauge },
  em_rota: { rotulo: "Em rota", tom: "alerta", icone: Truck },
  sem_bonus: { rotulo: "Sem bônus", tom: "erro", icone: CircleX },
};

/** Opções do filtro de hora extra, com o rótulo da etiqueta "Filtrando por". */
export const ROTULO_DA_HORA_EXTRA: Record<string, string> = {
  [TODAS]: "Todas",
  sim: "Fez hora extra",
  nao: "Não fez",
  sem_ponto: "Sem registro de ponto",
};

export const pct = (v: number) => `${Math.round(v * 100)}%`;
