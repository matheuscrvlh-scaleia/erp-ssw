import { CircleCheck, CircleX, type LucideIcon, ShieldX, Unlink } from "lucide-react";

import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";

type SituacaoDoEvento = "processado" | "sem_vinculo" | "rejeitado" | "erro";

/** Mesma classificação dos contadores do diagnóstico (rejeitado = auth/4xx; erro = 5xx). */
export function situacaoDoEvento(e: {
  statusHttp: number;
  autenticado: boolean;
}): SituacaoDoEvento {
  if (!e.autenticado || (e.statusHttp >= 400 && e.statusHttp < 500)) return "rejeitado";
  if (e.statusHttp >= 500) return "erro";
  if (e.statusHttp === 202) return "sem_vinculo";
  return "processado";
}

const SELO = {
  processado: { rotulo: "processado", tom: "sucesso", icone: CircleCheck },
  sem_vinculo: { rotulo: "sem vínculo", tom: "alerta", icone: Unlink },
  rejeitado: { rotulo: "rejeitado", tom: "alerta", icone: ShieldX },
  erro: { rotulo: "erro", tom: "erro", icone: CircleX },
} as const satisfies Record<SituacaoDoEvento, { rotulo: string; tom: Tom; icone: LucideIcon }>;

export function SeloDoEvento({ situacao }: { situacao: SituacaoDoEvento }) {
  const s = SELO[situacao];
  return (
    <SeloStatus tom={s.tom} icone={s.icone}>
      {s.rotulo}
    </SeloStatus>
  );
}
