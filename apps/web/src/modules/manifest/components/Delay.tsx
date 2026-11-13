import { entregueDaLinha } from "@erp/domain/manifest/row";
import { type LinhaLista } from "@erp/shared/contracts/manifest";

import { SeloStatus } from "@/components/common/StatusBadge";

import { situacaoDe } from "../rules";
import { diasPorExtenso } from "../texts";

export function Atraso({
  linha: l,
  dias,
  fonte,
}: {
  linha: LinhaLista;
  dias: number;
  fonte: string;
}) {
  if (l.baixadoSemEntrega) {
    return (
      <span className="text-muted-foreground" title="Encerrado por baixa formal">
        —
      </span>
    );
  }
  if (l.responsabilidadeCliente) {
    return (
      <SeloStatus tom="neutro" semIcone>
        Resp. cliente
      </SeloStatus>
    );
  }
  if (dias > 0) {
    return (
      <span className="font-semibold text-status-bad-fg" title={`fonte: ${fonte}`}>
        {diasPorExtenso(dias)}
      </span>
    );
  }
  if (entregueDaLinha(situacaoDe(l))) {
    return l.performanceDias === null ? (
      <span className="text-muted-foreground" title="Aguardando dados do BI2">
        —
      </span>
    ) : (
      <span className="font-semibold text-status-good-fg">No prazo</span>
    );
  }
  return (
    <span className="text-muted-foreground" title="Em trânsito, dentro do prazo previsto">
      —
    </span>
  );
}
