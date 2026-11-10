import { statusDoSla } from "@erp/dominio/performance/tela";
import { type UnidadeResumo } from "@erp/shared/contratos/performance";
import { Download } from "lucide-react";

import { exportarCsv } from "../exportacao-local";
import { corDoStatus, fmtPct, fundoDoStatus, textoDoStatus } from "../formato";
import { clicavel } from "./Kpis";

export interface LinhaDaUnidade extends UnidadeResumo {
  slaOp: number | null;
  nascidosPct: number | null;
}

/** "Performance por unidade": ordenada pelo SLA Op.; clique abre os CT-e da unidade. */
export function TabelaDeUnidades({
  linhas,
  ordem,
  carregando,
  periodo,
  empresa,
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
  empresa: string;
  meta: number;
  alerta: number;
  onInverterOrdem: () => void;
  onUnidade: (sigla: string) => void;
  onPenalizados: (sigla: string) => void;
}) {
  const exportar = () => { exportarCsv({
      arquivo: "performance-por-unidade",
      titulo: "Performance por unidade",
      subtitulo: `${periodo.inicio} → ${periodo.fim}`,
      empresa,
      colunas: [
        { chave: "sigla", titulo: "Unidade destino" },
        { chave: "total", titulo: "Total CTRCs" },
        { chave: "concluidos", titulo: "Concluídos" },
        { chave: "penalizadosAbertos", titulo: "Penalizados em aberto" },
        { chave: "penalizados", titulo: "Penalizados concluídos" },
        { chave: "slaOp", titulo: "SLA Op. (%)" },
        { chave: "nascidosPct", titulo: "Nascidos em atraso (%)" },
      ],
      linhas,
    }); };
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
          {/* TODO(kit-ui): trocar pelo ExportMenu do kit (Excel/PDF/CSV/imprimir). */}
          <button
            type="button"
            onClick={exportar}
            disabled={linhas.length === 0}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
            title="Exportar tabela (CSV)"
            aria-label="Exportar tabela"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
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
            onClick={() => { onUnidade(l.sigla); }}
            onPenalizados={() => { onPenalizados(l.sigla); }}
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
  const status = sla != null ? statusDoSla(sla, meta, alerta) : "good";
  const ruim = sla != null && status === "bad";
  const abertos = linha.penalizadosAbertos;
  const rotulo = `${abertos} penalizado${abertos === 1 ? "" : "s"} em aberto`;
  return (
    <li
      className="flex cursor-pointer items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/40"
      style={ruim ? { background: fundoDoStatus.bad } : undefined}
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
            style={ruim ? { color: textoDoStatus.bad } : undefined}
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
              style={{ color: textoDoStatus.bad }}
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
        {sla != null ? fmtPct(sla) : "—"}
      </div>
      <div className="hidden w-20 shrink-0 text-right text-[13px] text-muted-foreground tabular-nums md:block">
        {linha.nascidosPct != null ? fmtPct(linha.nascidosPct) : "—"}
      </div>
    </li>
  );
}
