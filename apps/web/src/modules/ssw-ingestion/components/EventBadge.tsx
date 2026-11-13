import { CircleCheck, CircleX, type LucideIcon, ShieldX, Unlink } from "lucide-react";

import { SeloStatus, type Tom } from "@/components/common/StatusBadge";

import { type SituacaoDoEvento } from "../rules";

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
