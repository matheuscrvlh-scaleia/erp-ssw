import { formatarDataHora, formatarInteiro } from "@erp/shared/formatacao";
import { FileClock, Unlink } from "lucide-react";

import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { Secao } from "@/componentes/layout/Pagina";

export function CartaoOrfaos({
  orfaos,
}: {
  orfaos: {
    webhookSemVinculo7d: number;
    recentes: { id: string; recebidoEm: string; numero: string | null }[];
    xmlPendentes: number;
  };
}) {
  return (
    <Secao titulo="Órfãos">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          rotulo="Webhook sem CT-e (7 dias)"
          valor={formatarInteiro(orfaos.webhookSemVinculo7d)}
          status={orfaos.webhookSemVinculo7d > 0 ? "alerta" : "bom"}
          detalhe="ocorrência recebida para número que não existe"
          icone={Unlink}
        />
        <KpiCard
          rotulo="XML de CT-e aguardando"
          valor={formatarInteiro(orfaos.xmlPendentes)}
          status={orfaos.xmlPendentes > 0 ? "alerta" : "bom"}
          detalhe="XML do FTP sem o CT-e correspondente"
          icone={FileClock}
        />
        {orfaos.recentes.length > 0 && (
          <Painel className="md:col-span-2 xl:col-span-1">
            <ul className="rolagem-fina max-h-[168px] divide-y divide-border overflow-y-auto text-[13px]">
              {orfaos.recentes.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-muted-foreground tabular-nums">
                    {formatarDataHora(o.recebidoEm)}
                  </span>
                  <span className="font-mono font-semibold">{o.numero ?? "—"}</span>
                </li>
              ))}
            </ul>
          </Painel>
        )}
      </div>
    </Secao>
  );
}
