import { statusDoSla } from "@erp/dominio/performance/tela";
import { type UnidadeResumo } from "@erp/shared/contratos/performance";
import { formatarPercentual } from "@erp/shared/formatacao";

import { ExportMenu } from "@/componentes/comum/ExportMenu";

import { corDoStatus, fundoDoStatus, textoDoStatus } from "../cores";
import { clicavel } from "./Kpis";

type LinhaDaUnidade = UnidadeResumo & {
  slaOp: number | null;
  nascidosPct: number | null;
};

/** "Performance por unidade": ordenada pelo SLA Op.; clique abre os CT-e da unidade. */
export function TabelaDeUnidades({
  linhas,
  ordem,
  carregando,
  periodo,
  meta,
  alerta,
  onInverterOrdem,
  onUnidade,
  onPenalizados,
}: {
  linhas: readonly LinhaDaUnidade[];
  ordem: "pior" | "melhor";
  carregando: boolean;
  periodo: { inicio: string; fim: string };
  meta: number;
  alerta: number;
  onInverterOrdem: () => void;
  onUnidade: (sigla: string) => void;
  onPenalizados: (sigla: string) => void;
}) {
  return (
    <div className="rounded-[10px] border border-border/70 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <button
          className="label-xs hover:text-foreground"
          onClick={onInverterOrdem}
          title="Clique para inverter a ordem"
        >
          Performance por unidade {ordem === "pior" ? "↑" : "↓"}
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">{linhas.length} unidades</span>
          <ExportMenu
            soIcone
            arquivo="performance-por-unidade"
            titulo="Performance por unidade"
            subtitulo={`${periodo.inicio} → ${periodo.fim}`}
            colunas={[
              { chave: "sigla", titulo: "Unidade destino" },
              { chave: "total", titulo: "Total CTRCs", formato: "inteiro" },
              { chave: "concluidos", titulo: "Concluídos", formato: "inteiro" },
              { chave: "penalizadosAbertos", titulo: "Penalizados em aberto", formato: "inteiro" },
              { chave: "penalizados", titulo: "Penalizados concluídos", formato: "inteiro" },
              { chave: "slaOp", titulo: "SLA Op. (%)", formato: "percentual" },
              { chave: "nascidosPct", titulo: "Nascidos em atraso (%)", formato: "percentual" },
            ]}
            linhas={linhas}
          />
        </div>
      </div>
      <div className="flex items-center gap-4 border-b border-border/60 bg-muted/30 px-5 py-2 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
        <span className="h-[7px] w-[7px] shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">Unidade destino</span>
        <span className="hidden w-[90px] shrink-0 sm:block" aria-hidden />
        <span
          className="w-20 shrink-0 text-right"
          title="SLA Operacional: (CT-e emitidos − entregues fora do prazo) ÷ CT-e emitidos. Fora do prazo exclui responsabilidade do cliente."
        >
          SLA Op.
        </span>
        <span
          className="hidden w-20 shrink-0 text-right md:block"
          title="Nascidos em atraso: CTRCs emitidos a menos de 48 horas (corridas) da previsão de entrega (atraso do parceiro)."
        >
          Nasc. atraso
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {linhas.map((l) => (
          <LinhaDeUnidade
            key={l.sigla}
            linha={l}
            meta={meta}
            alerta={alerta}
            onClick={() => {
              onUnidade(l.sigla);
            }}
            onPenalizados={() => {
              onPenalizados(l.sigla);
            }}
          />
        ))}
        {linhas.length === 0 && !carregando && (
          <li className="px-5 py-8 text-center text-[13px] text-muted-foreground">
            Sem dados de CTRCs para os filtros selecionados.
          </li>
        )}
      </ul>
    </div>
  );
}

function LinhaDeUnidade({
  linha,
  meta,
  alerta,
  onClick,
  onPenalizados,
}: {
  linha: LinhaDaUnidade;
  meta: number;
  alerta: number;
  onClick: () => void;
  onPenalizados: () => void;
}) {
  const sla = linha.slaOp;
  const status = sla != null ? statusDoSla(sla, meta, alerta) : "bom";
  const ruim = sla != null && status === "ruim";
  const abertos = linha.penalizadosAbertos;
  const rotulo = `${abertos} penalizado${abertos === 1 ? "" : "s"} em aberto`;
  return (
    <li
      className="flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
      style={ruim ? { background: fundoDoStatus.ruim } : undefined}
      title="Ver CTRCs com atraso, ocorrências e NFs desta unidade"
      {...clicavel(onClick)}
    >
      <span
        className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ backgroundColor: sla != null ? corDoStatus[status] : "var(--muted-foreground)" }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className="text-[13px] font-medium tabular-nums"
            style={ruim ? { color: textoDoStatus.ruim } : undefined}
          >
            {linha.sigla}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {linha.total} CTRCs ·{" "}
            {abertos > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPenalizados();
                }}
                className="underline decoration-dotted underline-offset-2 hover:text-foreground focus:outline-none"
                title="Ver os CTRCs penalizados desta unidade que ainda estão em aberto (sem entrega e sem baixa finalizadora)"
              >
                {rotulo}
              </button>
            ) : (
              rotulo
            )}
          </span>
          {ruim && abertos > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPenalizados();
              }}
              className="text-[11px] font-medium underline decoration-dotted underline-offset-2 hover:opacity-80 focus:outline-none"
              style={{ color: textoDoStatus.ruim }}
              title="Ver os CTRCs penalizados desta unidade que ainda estão em aberto"
            >
              · agir agora
            </button>
          )}
        </div>
      </div>
      <div className="hidden h-[5px] w-[90px] shrink-0 overflow-hidden rounded-full bg-border/60 sm:block">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(2, Math.min(100, (sla ?? 0) * 100))}%`,
            backgroundColor: sla != null ? corDoStatus[status] : "transparent",
          }}
        />
      </div>
      <div
        className="w-20 shrink-0 text-right text-[13px] font-medium tabular-nums"
        style={{ color: sla != null ? textoDoStatus[status] : "var(--muted-foreground)" }}
      >
        {sla != null ? formatarPercentual(sla, { separador: "." }) : "—"}
      </div>
      <div className="hidden w-20 shrink-0 text-right text-[13px] text-muted-foreground tabular-nums md:block">
        {linha.nascidosPct != null
          ? formatarPercentual(linha.nascidosPct, { separador: "." })
          : "—"}
      </div>
    </li>
  );
}
