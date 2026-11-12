import { type LinhaBonificacao } from "@erp/dominio/bonificacao-entrega";
import { formatarMoeda } from "@erp/shared/formatacao";
import { CalendarX, PackageCheck, UsersRound, Wallet } from "lucide-react";

import { KpiCard } from "@/componentes/comum/KpiCard";

/** Os quatro cartões do recorte apurado. */
export function IndicadoresBonificacao({
  colaboradores,
  linhas,
  total,
  semPonto,
}: {
  colaboradores: number;
  linhas: readonly LinhaBonificacao[];
  total: number;
  semPonto: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        rotulo="Colaboradores"
        valor={String(colaboradores)}
        status="bom"
        neutro
        icone={UsersRound}
        detalhe={`${String(linhas.length)} lançamentos pessoa-dia`}
      />
      <KpiCard
        rotulo="NFs entregues"
        valor={String(linhas.reduce((a, l) => a + l.nfsEntregues, 0))}
        status="bom"
        neutro
        icone={PackageCheck}
        detalhe="carregadas − SAC − retornos"
      />
      <KpiCard
        rotulo="Custo total"
        valor={formatarMoeda(total)}
        status="bom"
        neutro
        icone={Wallet}
        detalhe="soma do bônus no recorte"
      />
      <KpiCard
        rotulo="Dias sem ponto"
        valor={String(semPonto)}
        status={semPonto > 0 ? "alerta" : "bom"}
        icone={CalendarX}
        detalhe={semPonto > 0 ? "nível limitado a Acelerado" : "todos com ponto"}
      />
    </div>
  );
}
