import { type RelatorioPeriodo } from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarMoeda } from "@erp/shared/formatacao";

import { Alternador } from "@/componentes/comum/Alternador";

import { type Indicador, indicadoresDoRelatorio } from "../regras";
import { dataBr } from "../textos";
import { DistribuicaoPontualidade } from "./DistribuicaoPontualidade";
import { TabelaDeImpacto } from "./TabelaDeImpacto";
import { TabelaSlaPorUnidade } from "./TabelaSlaPorUnidade";

/** Corpo do relatório de período: indicadores, penalizantes, previstos e tabelas. */
export function CorpoDoRelatorio({
  r,
  codigos,
  nomeCurto,
  modoPrevistos,
  onModoPrevistos,
}: {
  r: RelatorioPeriodo;
  codigos: string[];
  nomeCurto: string;
  modoPrevistos: "todos" | "periodo";
  onModoPrevistos: (m: "todos" | "periodo") => void;
}) {
  const indicadores = indicadoresDoRelatorio(r, codigos);
  const a = r.atual;
  const cmp = r.comparativo;
  const meta = r.limites.slaMetaPct;
  const prev = modoPrevistos === "todos" ? r.previstosTodos : r.previstosPeriodo;
  const secao = (nome: Indicador["secao"]) => indicadores.filter((i) => i.secao === nome);
  const titulo = "label-xs";
  return (
    <div className="space-y-4">
      <div className="text-[12.5px] text-muted-foreground">
        Período principal:{" "}
        <strong className="text-foreground">
          {dataBr(r.periodo.inicio)} → {dataBr(r.periodo.fim)}
        </strong>
        {cmp && (
          <>
            {" · "}Comparativo:{" "}
            <strong className="text-foreground">
              {dataBr(cmp.periodo.inicio)} → {dataBr(cmp.periodo.fim)}
            </strong>
          </>
        )}
      </div>

      <section className="space-y-2">
        <h4 className={titulo}>Produção</h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {secao("Produção").map((i) => (
            <CartaoDoIndicador key={i.rotulo} i={i} />
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className={titulo}>Qualidade</h4>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-7">
          {secao("Qualidade").map((i) => (
            <CartaoDoIndicador key={i.rotulo} i={i} />
          ))}
        </div>
        <p className="rounded-lg border border-border bg-muted px-4 py-2.5 text-[12.5px] text-muted-foreground">
          Prejuízo conta apenas os CT-e cuja ocorrência penalizante é{" "}
          {codigos.length > 0
            ? `um dos códigos selecionados (${codigos.join(", ")})`
            : "o código 13 (padrão do sistema)"}
          .
        </p>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="label-xs mb-3">Como estão os CTRCs em relação ao prazo</div>
          <DistribuicaoPontualidade
            noPrazo={a.noPrazo}
            foraPrazo={a.foraPrazo}
            excluidoCliente={a.pendentePrazo}
            semInfo={a.semPrazo}
            nomeCurto={nomeCurto}
          />
        </div>
      </section>

      <div className="rounded-xl border border-status-bad/30 bg-status-bad-bg p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <span className={titulo}>Penalizantes</span>
          {cmp && (
            <span className="text-xs text-muted-foreground">
              comparativo: {formatarInteiro(cmp.penalizantes.ocorrencias)} ocorrências ·{" "}
              {formatarInteiro(cmp.penalizantes.ctrcsAfetados)} CTRCs
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-bold text-status-bad-fg tabular-nums">
            {formatarInteiro(r.penalizantes.ocorrencias)}
          </span>
          <span className="text-[13px] text-muted-foreground">
            ocorrências ·{" "}
            <strong className="text-foreground">
              {formatarInteiro(r.penalizantes.ctrcsAfetados)}
            </strong>{" "}
            CTRCs afetados
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <div className="text-[15px] font-bold">Previstos</div>
            <div className="text-[12.5px] text-muted-foreground">
              CTRCs ainda não entregues · {formatarInteiro(prev.total.qtd)} no total ·{" "}
              {formatarMoeda(prev.total.frete)}
            </div>
          </div>
          <Alternador
            rotulo="Previstos"
            tamanho="pequeno"
            valor={modoPrevistos}
            aoMudar={onModoPrevistos}
            opcoes={[
              { valor: "todos", rotulo: "Todos em aberto" },
              { valor: "periodo", rotulo: "Emitidos no período" },
            ]}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {(
            [
              ["Por status da última ocorrência", prev.status],
              ["Por faixa de vencimento", prev.faixa],
            ] as const
          ).map(([nome, itens]) => (
            <div key={nome}>
              <div className="label-xs mb-2">{nome}</div>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {itens.map((b) => (
                  <div
                    key={b.key}
                    className={
                      "rounded-lg border px-2.5 py-2 " +
                      (b.key === "vencido"
                        ? "border-status-bad/30 bg-status-bad-bg text-status-bad-fg"
                        : "border-border bg-muted/60 text-muted-foreground")
                    }
                  >
                    <div className="text-xs font-semibold tracking-wide uppercase">{b.key}</div>
                    <div className="text-[15px] font-bold text-foreground tabular-nums">
                      {formatarInteiro(b.qtd)}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatarMoeda(b.frete)}</div>
                  </div>
                ))}
                {itens.length === 0 && (
                  <div className="col-span-full text-center text-[12.5px] text-muted-foreground">
                    Sem dados.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TabelaSlaPorUnidade r={r} meta={meta} />

      {r.finalizadoPorCodigo.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-3 text-[15px] font-bold">
            <span>Finalizado em Sistema por código</span>
            <span className="text-xs font-normal text-muted-foreground">
              total: {formatarInteiro(a.finalizadoSistema)} CTRCs
            </span>
          </div>
          <table className="w-full text-[13px]">
            <thead className="bg-muted/70 text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Código</th>
                <th className="px-4 py-2.5 text-left font-medium">Descrição</th>
                <th className="px-4 py-2.5 text-right font-medium">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {r.finalizadoPorCodigo.map((f) => (
                <tr key={f.codigo} className="border-t border-border hover:bg-muted/60">
                  <td className="px-4 py-2.5 font-mono text-xs">{f.codigo}</td>
                  <td className="px-4 py-2.5">{f.descricao ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatarInteiro(f.qtd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {r.impactoCodigos.length > 0 && <TabelaDeImpacto r={r} />}
    </div>
  );
}

function CartaoDoIndicador({ i }: { i: Indicador }) {
  const tom = (t: string) =>
    t === "bom" ? "text-status-good-fg" : t === "ruim" ? "text-status-bad-fg" : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5" title={i.dica}>
      <div className="label-xs">{i.rotulo}</div>
      {i.legenda ? (
        <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{i.legenda}</div>
      ) : null}
      <div className={"mt-1 text-[18px] font-bold tabular-nums " + tom(i.tom)}>{i.valor}</div>
      {i.comparativo && (
        <div className="mt-1 flex items-baseline gap-1 text-xs">
          <span className="text-muted-foreground">vs</span>
          <span className="text-foreground/80 tabular-nums">{i.comparativo.valor}</span>
          {i.comparativo.delta && (
            <span
              className={
                "ml-auto font-semibold tabular-nums " +
                (i.comparativo.delta.tom === "neutro"
                  ? "text-muted-foreground"
                  : tom(i.comparativo.delta.tom))
              }
            >
              {i.comparativo.delta.texto}
            </span>
          )}
        </div>
      )}
      {i.sub ? <div className="mt-0.5 text-xs text-muted-foreground">{i.sub}</div> : null}
    </div>
  );
}
