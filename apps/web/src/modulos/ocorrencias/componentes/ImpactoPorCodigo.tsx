import { type CampoData, type PainelDeOcorrencias } from "@erp/shared/contratos/ocorrencias";
import { formatarDecimal, formatarInteiro, formatarPercentual } from "@erp/shared/formatacao";
import { AlertTriangle, TrendingDown } from "lucide-react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { Painel } from "@/componentes/comum/Painel";
import { cn } from "@/lib/utils";

import { type RecortesDosBlocos } from "../busca";
import { TituloComDica } from "./TituloComDica";

const fracao = (ocorrencias: number, ctes: number) => (ctes > 0 ? ocorrencias / ctes : null);

/** Impacto de cada código sobre os CT-e do período, com o mês anterior. */
export function ImpactoPorCodigo({
  painel,
  carregando,
  campoData,
  r,
}: {
  painel: PainelDeOcorrencias | undefined;
  carregando: boolean;
  campoData: CampoData;
  r: RecortesDosBlocos;
}) {
  const impacto = painel?.impacto;
  const linhas = impacto?.linhas ?? [];
  const ctes = impacto?.ctrcs ?? 0;
  const ctesAnterior = impacto?.ctrcsAnterior ?? 0;
  const base = campoData === "emissao" ? "emitidos" : "com previsão";
  const grade = "grid-cols-[70px_minmax(0,1fr)_100px_90px_100px_90px_90px]";
  const pct = (v: number | null) => (v === null ? "—" : formatarPercentual(v));
  return (
    <Painel
      titulo={
        <TituloComDica
          titulo="Impacto por código de ocorrência"
          dica={`% = quantidade de ocorrências do código ÷ total de CT-e ${base} no período (finalizados ou não). Conta cada ocorrência, não o CT-e: um CT-e com três ocorrências 13 entra três vezes. A comparação usa as mesmas datas do mês anterior, com os mesmos filtros. Clique numa linha para filtrar a tela.`}
        />
      }
      descricao={
        carregando
          ? "carregando…"
          : `${formatarInteiro(ctes)} CT-e ${base} no período · ${formatarInteiro(ctesAnterior)} no mês anterior`
      }
      icone={TrendingDown}
    >
      {!carregando && linhas.length === 0 && (
        <EstadoVazio
          mensagem="Sem ocorrências no período com os filtros atuais."
          detalhe="Amplie o período ou tire algum filtro."
        />
      )}
      {linhas.length > 0 && (
        <div className="rolagem-fina overflow-x-auto">
          <div className="min-w-[760px]">
            <div
              className={`grid ${grade} items-center gap-3 border-b border-border bg-muted/70 px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.04em] text-muted-foreground uppercase`}
            >
              <span>Código</span>
              <span>Descrição</span>
              <span className="text-right">Ocorrências</span>
              <span className="text-right">% dos CT-e</span>
              <span className="text-right">Mês anterior</span>
              <span className="text-right">% anterior</span>
              <span className="text-right">Variação</span>
            </div>
            <ul className="rolagem-fina max-h-[420px] divide-y divide-border overflow-y-auto">
              {linhas.map((l) => {
                const atual = fracao(l.ocorrencias, ctes);
                const antes = fracao(l.ocorrenciasAnterior, ctesAnterior);
                const delta = atual !== null && antes !== null ? atual - antes : null;
                const ativo = r.codigo === l.codigo;
                const corDelta =
                  delta === null || Math.abs(delta) < 0.0005
                    ? "text-muted-foreground"
                    : delta > 0
                      ? "text-status-bad-fg"
                      : "text-status-good-fg";
                return (
                  <li key={l.codigo}>
                    <button
                      type="button"
                      aria-pressed={ativo}
                      title="Filtrar toda a tela por este código"
                      onClick={() => {
                        r.aoCodigo(ativo ? null : l.codigo);
                      }}
                      className={cn(
                        `grid w-full ${grade} items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors`,
                        ativo ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="inline-flex items-center gap-1 font-mono font-bold tabular-nums">
                        {l.penaliza && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 text-status-bad"
                            aria-label="Penaliza"
                          />
                        )}
                        {l.codigo}
                      </span>
                      <span className="truncate font-medium">{l.descricao}</span>
                      <span className="text-right font-bold tabular-nums">
                        {formatarInteiro(l.ocorrencias)}
                      </span>
                      <span className="text-right font-bold tabular-nums">{pct(atual)}</span>
                      <span className="text-right text-muted-foreground tabular-nums">
                        {formatarInteiro(l.ocorrenciasAnterior)}
                      </span>
                      <span className="text-right text-muted-foreground tabular-nums">
                        {pct(antes)}
                      </span>
                      <span className={`text-right font-bold tabular-nums ${corDelta}`}>
                        {delta === null
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${formatarDecimal(Math.round(delta * 1000) / 10)} p.p.`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </Painel>
  );
}
