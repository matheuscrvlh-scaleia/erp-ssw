import { type OpcaoDeCtrc } from "@erp/shared/contracts/ctrc";
import { formatarData } from "@erp/shared/formatting";
import { Link } from "@tanstack/react-router";
import { ChevronRight, FileText } from "lucide-react";

import { Painel } from "@/components/common/Panel";

/** Q02: o mesmo número em mais de uma série — o operador escolhe qual abrir. */
export function EscolhaDeSerie({
  numero,
  opcoes,
}: {
  numero: string;
  opcoes: readonly OpcaoDeCtrc[];
}) {
  return (
    <Painel
      titulo={`O número ${numero} existe em ${String(opcoes.length)} séries. Qual CT-e você quer abrir?`}
      icone={FileText}
    >
      <ul className="divide-y divide-border">
        {opcoes.map((o) => (
          <li key={`${o.sigla}-${o.numero}`}>
            <Link
              to="/ctrc/$numero"
              params={{ numero: o.numero }}
              search={{ sigla: o.sigla }}
              className="group flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-[13px] transition-colors last:rounded-b-xl hover:bg-muted"
            >
              <span className="font-mono font-semibold text-brand">
                {o.sigla} {o.numero}
              </span>
              <span className="text-muted-foreground">Emissão {formatarData(o.dataEmissao)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{o.destinatario ?? "—"}</span>
              <span className="text-muted-foreground">{o.cidadeDestino ?? "—"}</span>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </Painel>
  );
}
