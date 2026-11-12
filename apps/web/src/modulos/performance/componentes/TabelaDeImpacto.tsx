import { type RelatorioPeriodo } from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";

/** "Impacto por código de última ocorrência" do relatório de período (top 20). */
export function TabelaDeImpacto({ r }: { r: RelatorioPeriodo }) {
  const cmp = r.comparativo;
  const doComparativo = new Map((cmp?.impactoCodigos ?? []).map((i) => [i.codigo, i]));
  const pct = (v: number) => formatarPercentual(v, { escala: "cem" });
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3 text-[15px] font-bold">
        <span>Impacto por código de última ocorrência</span>
        <span className="text-xs font-normal text-muted-foreground">
          base: {formatarInteiro(r.impactoBaseComOcorrencia)} CTRCs com ocorrência registrada
          {cmp && ` · comparativo: ${formatarInteiro(cmp.impactoBaseComOcorrencia)}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/70 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Código</th>
              <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
              <th className="px-4 py-2.5 text-right font-medium">CTRCs {cmp && "(P)"}</th>
              {cmp && <th className="px-4 py-2.5 text-right font-medium">CTRCs (C)</th>}
              <th className="px-4 py-2.5 text-right font-medium">% total {cmp && "(P)"}</th>
              {cmp && <th className="px-4 py-2.5 text-right font-medium">% total (C)</th>}
            </tr>
          </thead>
          <tbody>
            {r.impactoCodigos.slice(0, 20).map((i) => {
              const c = doComparativo.get(i.codigo);
              return (
                <tr key={i.codigo} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{i.codigo}</td>
                  <td className="px-4 py-2.5">
                    <span className={i.penaliza ? "text-status-bad-fg" : ""}>
                      {i.descricao ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {formatarInteiro(i.totalCtrcs)}
                  </td>
                  {cmp && (
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {c ? formatarInteiro(c.totalCtrcs) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums">{pct(i.pctDoTotal)}</td>
                  {cmp && (
                    <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums">
                      {c ? pct(c.pctDoTotal) : "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
