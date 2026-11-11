import { type LinhaBonificacao } from "@erp/dominio/bonificacao-entrega";
import { CircleX, Gauge, type LucideIcon, Truck, Zap } from "lucide-react";

import { type Tom } from "@/componentes/comum/SeloStatus";

type Nivel = LinhaBonificacao["nivel"];

/** Nome, tom do selo e ícone de cada nível (tabela da apuração e "Como funciona"). */
export const NIVEL: Record<Nivel, { rotulo: string; tom: Tom; icone: LucideIcon }> = {
  turbo: { rotulo: "Turbo", tom: "sucesso", icone: Zap },
  acelerado: { rotulo: "Acelerado", tom: "info", icone: Gauge },
  em_rota: { rotulo: "Em rota", tom: "alerta", icone: Truck },
  sem_bonus: { rotulo: "Sem bônus", tom: "erro", icone: CircleX },
};
