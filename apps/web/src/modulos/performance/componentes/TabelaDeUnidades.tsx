import { type Status, statusDoSla } from "@erp/dominio/performance/tela";
import { type UnidadeResumo } from "@erp/shared/contratos/performance";
import { formatarPercentual } from "@erp/shared/formatacao";
import { ArrowDown, ArrowUp, Building2 } from "lucide-react";
import { type KeyboardEvent } from "react";

import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus, type Tom } from "@/componentes/comum/SeloStatus";
import { cn } from "@/lib/utils";

import { corDoStatus } from "../textos";

type LinhaDaUnidade = UnidadeResumo & {
  slaOp: number | null;
  nascidosPct: number | null;
};

const TOM_DO_STATUS: Record<Status, Tom> = { bom: "sucesso", alerta: "alerta", ruim: "erro" };

const CABECALHO = "label-xs";

/** Props de um bloco clicável por mouse e teclado (Enter/Espaço). */
function clicavel(acao: (() => void) | undefined, pararPropagacao = false) {
  if (!acao) return {};
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (e: { stopPropagation: () => void }) => {
      if (pararPropagacao) e.stopPropagation();
      acao();
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      if (pararPropagacao) e.stopPropagation();
      acao();
    },
  };
}

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
  const Seta = ordem === "pior" ? ArrowUp : ArrowDown;
  return (
    <Painel
      titulo={
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md hover:text-brand"
          onClick={onInverterOrdem}
          title="Clique para inverter a ordem"
        >
          Performance por unidade
          <Seta className="h-4 w-4" aria-label={ordem === "pior" ? "↑" : "↓"} />
        </button>
      }
      descricao={`${String(linhas.length)} unidades`}
      icone={Building2}
      acoes={
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
      }
    >
      <div className="flex items-center gap-4 border-b border-border bg-muted/70 px-4 py-2.5">
        <span className={cn(CABECALHO, "min-w-0 flex-1")}>Unidade destino</span>
        <span className="hidden w-[120px] shrink-0 sm:block" aria-hidden />
        <span
          className={cn(CABECALHO, "w-24 shrink-0 text-right")}
          title="SLA Operacional: (CT-e emitidos − entregues fora do prazo) ÷ CT-e emitidos. Fora do prazo exclui responsabilidade do cliente."
        >
          SLA Op.
        </span>
        <span
          className={cn(CABECALHO, "hidden w-24 shrink-0 text-right md:block")}
          title="Nascidos em atraso: CTRCs emitidos a menos de 48 horas (corridas) da previsão de entrega (atraso do parceiro)."
        >
          Nasc. atraso
        </span>
      </div>
      <ul className="divide-y divide-border">
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
          <li>
            <EstadoVazio
              mensagem="Sem dados de CTRCs para os filtros selecionados."
              detalhe="Amplie o período ou tire algum filtro."
            />
          </li>
        )}
      </ul>
    </Painel>
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
  const rotulo = `${String(abertos)} penalizado${abertos === 1 ? "" : "s"} em aberto`;
  return (
    <li
      className={cn(
        "flex cursor-pointer items-center gap-4 px-4 py-2.5 text-[13px] transition-colors last:rounded-b-xl hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        ruim && "bg-status-bad-bg/60",
      )}
      title="Ver CTRCs com atraso, ocorrências e NFs desta unidade"
      {...clicavel(onClick)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            className={cn(
              "font-mono font-semibold tabular-nums",
              ruim ? "text-status-bad-fg" : "text-foreground",
            )}
          >
            {linha.sigla}
          </span>
          <span className="text-[12.5px] text-muted-foreground">
            {linha.total} CTRCs ·{" "}
            {abertos > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPenalizados();
                }}
                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
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
              className="text-[12.5px] font-semibold text-status-bad-fg underline decoration-dotted underline-offset-2 hover:opacity-80"
              title="Ver os CTRCs penalizados desta unidade que ainda estão em aberto"
            >
              · agir agora
            </button>
          )}
        </div>
      </div>
      <div className="hidden h-1.5 w-[120px] shrink-0 overflow-hidden rounded-full bg-muted sm:block">
        <div
          className="h-full rounded-full"
          style={{
            width: `${String(Math.max(2, Math.min(100, (sla ?? 0) * 100)))}%`,
            backgroundColor: sla != null ? corDoStatus[status] : "transparent",
          }}
        />
      </div>
      <div className="flex w-24 shrink-0 justify-end">
        {sla != null ? (
          <SeloStatus tom={TOM_DO_STATUS[status]} className="tabular-nums">
            {formatarPercentual(sla, { separador: "." })}
          </SeloStatus>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </div>
      <div className="hidden w-24 shrink-0 text-right text-muted-foreground tabular-nums md:block">
        {linha.nascidosPct != null
          ? formatarPercentual(linha.nascidosPct, { separador: "." })
          : "—"}
      </div>
    </li>
  );
}
