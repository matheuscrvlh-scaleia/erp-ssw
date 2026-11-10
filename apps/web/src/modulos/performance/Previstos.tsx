import {
  type FaixaPrevisto,
  type Previstos,
  type SomasPrevisto,
  type StatusPrevisto,
} from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarMoeda, formatarPeso } from "@erp/shared/formatacao";
import { ArrowRight } from "lucide-react";

export type CliqueNosPrevistos =
  | { eixo: "status"; chave: StatusPrevisto }
  | { eixo: "faixa"; chave: FaixaPrevisto }
  | { eixo: "total" };

const STATUS: { chave: StatusPrevisto; rotulo: string; someSeZero?: boolean }[] = [
  { chave: "agendamento", rotulo: "Agendamento" },
  { chave: "programacao", rotulo: "Programação" },
  { chave: "rota", rotulo: "Em rota de entrega" },
  { chave: "pendencia", rotulo: "Pendência" },
  { chave: "outros", rotulo: "Outros", someSeZero: true },
];

const FAIXAS: { chave: FaixaPrevisto; rotulo: string; perigo?: boolean; someSeZero?: boolean }[] = [
  { chave: "vencido", rotulo: "Vencido", perigo: true },
  { chave: "hoje", rotulo: "Vence hoje" },
  { chave: "d1", rotulo: "D+1" },
  { chave: "d2", rotulo: "D+2" },
  { chave: "d3_mais", rotulo: "D+3+" },
  { chave: "sem_prev", rotulo: "Sem previsão", someSeZero: true },
];

const VAZIO: Previstos = {
  status: [],
  faixa: [],
  total: { qtd: 0, peso: 0, volumes: 0, frete: 0 },
};

/** Bloco "Previstos": CT-e ainda não entregues, por status e por faixa de vencimento. */
export function SecaoPrevistos({
  dados,
  carregando,
  ignorarPeriodo,
  onIgnorarPeriodo,
  onClique,
}: {
  dados: Previstos | undefined;
  carregando: boolean;
  ignorarPeriodo: boolean;
  onIgnorarPeriodo: (v: boolean) => void;
  onClique: (c: CliqueNosPrevistos) => void;
}) {
  const d = dados ?? VAZIO;
  const porStatus = new Map(d.status.map((s) => [s.key, s]));
  const porFaixa = new Map(d.faixa.map((f) => [f.key, f]));
  const mostrar = (someSeZero: boolean | undefined, b: SomasPrevisto | undefined) =>
    !(someSeZero && (!b || b.qtd === 0));

  const alternador = (ativo: boolean) =>
    "rounded-[5px] px-2.5 py-1 " +
    (ativo ? "bg-[var(--brand)] text-white" : "text-muted-foreground hover:bg-muted");

  return (
    <div className="rounded-[10px] border border-border/70 bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-5 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-xs">Previstos</span>
            <span
              className="inline-flex cursor-help items-center rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground"
              title="Documentos em aberto não têm data de conclusão. O controle válido aqui é 'Todos em aberto / Emitidos no período', ao lado."
            >
              sempre por emissão
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            CTRCs ainda não entregues ·{" "}
            {carregando || !dados ? "atualizando…" : `${formatarInteiro(d.total.qtd)} no total`}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Sempre por data de emissão; o alternador Emitidos/Data Prevista/Concluídos não afeta
            esta seção.
          </div>
          {ignorarPeriodo && (
            <div className="text-[11px]" style={{ color: "var(--brand)" }}>
              Modo <strong className="font-medium">Todos em aberto</strong>: mostra todos os CTRCs
              ainda não entregues, inclusive de meses anteriores — este bloco ignora o período
              escolhido no topo da tela. Nesse modo o número{" "}
              <strong className="font-medium">sai da partição de 100%</strong>: Entregues +
              Finalizado em Sistema + Previstos deixa de fechar com o total de CT-e emitidos do
              período. Use &quot;Emitidos no período&quot; ao lado para voltar à partição fechada.
            </div>
          )}
        </div>
        <div className="flex rounded-md border border-border/70 p-0.5 text-[12px]">
          <button
            onClick={() => {
              onIgnorarPeriodo(true);
            }}
            className={alternador(ignorarPeriodo)}
          >
            Todos em aberto
          </button>
          <button
            onClick={() => {
              onIgnorarPeriodo(false);
            }}
            className={alternador(!ignorarPeriodo)}
          >
            Emitidos no período
            <span className="ml-1 opacity-70">(emissão)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-border/60 p-4 md:grid-cols-[240px_1fr]">
        <button
          type="button"
          onClick={() => {
            onClique({ eixo: "total" });
          }}
          className="group rounded-lg border border-border/70 border-l-[5px] border-l-kpi-positive bg-card p-4 text-left transition-colors hover:border-border hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="label-xs font-bold text-foreground">Total previstos</span>
            <ArrowRight className="h-3 w-3 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--brand)]" />
          </div>
          <div className="num-hero mt-2 font-bold tracking-normal text-kpi-positive">
            {formatarInteiro(d.total.qtd)}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            {formatarPeso(d.total.peso)} · {formatarInteiro(d.total.volumes)} vol ·{" "}
            {formatarMoeda(d.total.frete, { centavos: false })}
          </div>
        </button>
        <div className="text-[11px] leading-relaxed text-muted-foreground">
          A soma das células em cada eixo é igual ao total. Cada célula é clicável e abre a listagem
          detalhada preservando os filtros ativos.
        </div>
      </div>

      <div className="border-b border-border/60 px-5 py-4">
        <div className="mb-2 text-[12px] font-medium">Por status da última ocorrência</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-5">
          {STATUS.filter((s) => mostrar(s.someSeZero, porStatus.get(s.chave))).map((s) => (
            <Celula
              key={s.chave}
              rotulo={s.rotulo}
              somas={porStatus.get(s.chave)}
              onClick={() => {
                onClique({ eixo: "status", chave: s.chave });
              }}
            />
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-2 text-[12px] font-medium">Por faixa de vencimento</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          {FAIXAS.filter((f) => mostrar(f.someSeZero, porFaixa.get(f.chave))).map((f) => (
            <Celula
              key={f.chave}
              rotulo={f.rotulo}
              somas={porFaixa.get(f.chave)}
              perigo={f.perigo}
              onClick={() => {
                onClique({ eixo: "faixa", chave: f.chave });
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Celula({
  rotulo,
  somas,
  perigo,
  onClick,
}: {
  rotulo: string;
  somas: SomasPrevisto | undefined;
  perigo?: boolean | undefined;
  onClick: () => void;
}) {
  const cor = perigo ? "var(--status-bad)" : "var(--kpi-positive)";
  return (
    <button
      onClick={onClick}
      style={{ borderLeftColor: cor }}
      className="rounded-lg border border-l-[5px] border-border/70 bg-card p-3 text-left transition-colors hover:bg-muted/40"
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{rotulo}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: cor }}>
        {formatarInteiro(somas?.qtd ?? 0)}
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        {formatarPeso(somas?.peso ?? 0)} · {formatarInteiro(somas?.volumes ?? 0)} vol
      </div>
    </button>
  );
}
