import { type RelatorioPeriodo } from "@erp/shared/contracts/performance";
import { formatarInteiro, formatarPercentual } from "@erp/shared/formatting";
import { Fragment } from "react";

/** "SLA por unidade" do relatório de período (comparativo: pares P/C). */
export function TabelaSlaPorUnidade({ r, meta }: { r: RelatorioPeriodo; meta: number }) {
  const cmp = r.comparativo;
  const doComparativo = new Map((cmp?.porUnidade ?? []).map((u) => [u.sigla, u]));
  const corDoSla = (v: number | null) =>
    v == null
      ? ""
      : v >= meta
        ? "text-status-good-fg"
        : v < meta - 5
          ? "font-semibold text-status-bad-fg"
          : "";
  const th = "px-4 py-2.5 text-right font-medium";
  const td = "px-4 py-2.5 text-right tabular-nums";
  const tdC = `${td} text-muted-foreground`;
  const p = cmp ? " (P)" : "";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-[15px] font-bold">
        SLA por unidade · meta {formatarPercentual(meta, { escala: "cem" })}
        {cmp && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            (P = principal · C = comparativo)
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="bg-muted/70 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Unidade</th>
              {(["Emitidos", "Entregues", "% Produção", "SLA Pont.", "SLA Op."] as const).map(
                (c) => (
                  <Fragment key={c}>
                    <th className={th}>
                      {c}
                      {p}
                    </th>
                    {cmp && <th className={th}>{c} (C)</th>}
                  </Fragment>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {r.porUnidade.length === 0 && (
              <tr>
                <td colSpan={cmp ? 11 : 6} className="px-3 py-6 text-center text-muted-foreground">
                  Sem unidades com movimento no período.
                </td>
              </tr>
            )}
            {r.porUnidade.map((u) => {
              const c = doComparativo.get(u.sigla);
              const comp = (v: string) => (cmp ? <td className={tdC}>{c ? v : "—"}</td> : null);
              return (
                <tr key={u.sigla} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{u.sigla}</div>
                    {u.cidade ? (
                      <div className="text-xs text-muted-foreground">
                        {u.cidade}
                        {u.uf ? `/${u.uf}` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className={td}>{formatarInteiro(u.total)}</td>
                  {comp(formatarInteiro(c?.total ?? 0))}
                  <td className={td}>{formatarInteiro(u.entregues)}</td>
                  {comp(formatarInteiro(c?.entregues ?? 0))}
                  <td className={td}>{formatarPercentual(u.producaoPct, { escala: "cem" })}</td>
                  {comp(formatarPercentual(c?.producaoPct ?? null, { escala: "cem" }))}
                  <td className={`${td} ${corDoSla(u.slaOperacionalPct)}`}>
                    {formatarPercentual(u.slaOperacionalPct, { escala: "cem" })}
                  </td>
                  {comp(formatarPercentual(c?.slaOperacionalPct ?? null, { escala: "cem" }))}
                  <td className={td}>
                    {formatarPercentual(u.slaPontualidadePct, { escala: "cem" })}
                  </td>
                  {comp(formatarPercentual(c?.slaPontualidadePct ?? null, { escala: "cem" }))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
