import { type ContagemWebhook } from "@erp/shared/contracts/ssw-ingestion";
import { formatarDataHora, formatarInteiro } from "@erp/shared/formatting";
import { CheckCheck, Inbox, ServerCrash, ShieldX, Unlink } from "lucide-react";

import { KpiCard } from "@/components/common/KpiCard";
import { Secao } from "@/components/layout/Page";

function KpisDoWebhook({ rotulo, c: n }: { rotulo: string; c: ContagemWebhook }) {
  return (
    <div className="space-y-2.5">
      <h3 className="label-xs">{rotulo}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          rotulo="Recebidos"
          valor={formatarInteiro(n.total)}
          status="bom"
          detalhe=""
          neutro
          icone={Inbox}
        />
        <KpiCard
          rotulo="Processados"
          valor={formatarInteiro(n.processados)}
          status="bom"
          detalhe=""
          icone={CheckCheck}
        />
        <KpiCard
          rotulo="Sem vínculo"
          valor={formatarInteiro(n.semVinculo)}
          status={n.semVinculo > 0 ? "alerta" : "bom"}
          detalhe="CT-e não encontrado"
          icone={Unlink}
        />
        <KpiCard
          rotulo="Rejeitados"
          valor={formatarInteiro(n.rejeitados)}
          status={n.rejeitados > 0 ? "alerta" : "bom"}
          detalhe="token, CNPJ ou formato"
          icone={ShieldX}
        />
        <KpiCard
          rotulo="Erros"
          valor={formatarInteiro(n.erros)}
          status={n.erros > 0 ? "ruim" : "bom"}
          detalhe="falha ao gravar"
          icone={ServerCrash}
        />
      </div>
    </div>
  );
}

export function CartaoWebhook({
  webhook,
}: {
  webhook: {
    ultimaAtividade: string | null;
    ultimas24h: ContagemWebhook;
    ultimos7d: ContagemWebhook;
  };
}) {
  return (
    <Secao
      titulo="Webhook SSW2181"
      descricao={`última atividade: ${webhook.ultimaAtividade ? formatarDataHora(webhook.ultimaAtividade) : "nenhuma"}`}
      className="space-y-4"
    >
      <KpisDoWebhook rotulo="Últimas 24 horas" c={webhook.ultimas24h} />
      <KpisDoWebhook rotulo="Últimos 7 dias" c={webhook.ultimos7d} />
    </Secao>
  );
}
