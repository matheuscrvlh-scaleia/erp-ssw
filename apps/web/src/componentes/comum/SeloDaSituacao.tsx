import { CircleMinus, Clock, Copy, type LucideIcon, RefreshCw, Trash2 } from "lucide-react";

import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";

/** Situação de ciclo, arquivo, aplicação, sincronização ou XML → tom e ícone do selo. */
const SITUACAO: Record<string, { tom: Tom; icone?: LucideIcon }> = {
  aplicado: { tom: "sucesso" },
  importado: { tom: "sucesso" },
  sucesso: { tom: "sucesso" },
  ok: { tom: "sucesso" },
  concluido: { tom: "sucesso" },
  aplicando: { tom: "info", icone: RefreshCw },
  importando: { tom: "info", icone: RefreshCw },
  em_andamento: { tom: "info", icone: RefreshCw },
  processando: { tom: "info", icone: RefreshCw },
  aguardando: { tom: "info", icone: Clock },
  pendente: { tom: "info", icone: Clock },
  aberto: { tom: "neutro" },
  parcial: { tom: "alerta" },
  pausado: { tom: "alerta" },
  duplicado: { tom: "neutro", icone: Copy },
  ignorado: { tom: "neutro", icone: CircleMinus },
  descartado: { tom: "neutro", icone: Trash2 },
  erro: { tom: "erro" },
};

/** Selo da situação como vem da API ("em_andamento" → "em andamento"), com ícone + texto. */
export function SeloDaSituacao({ status }: { status: string }) {
  const s = SITUACAO[status] ?? { tom: "neutro" };
  return (
    <SeloStatus tom={s.tom} icone={s.icone}>
      {status.replace(/_/g, " ")}
    </SeloStatus>
  );
}
