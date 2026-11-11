import {
  type FaixaPrevisto,
  type Previstos,
  type SomasPrevisto,
  type StatusPrevisto,
} from "@erp/shared/contratos/performance";
import { formatarInteiro, formatarMoeda, formatarPeso } from "@erp/shared/formatacao";
import { AlertTriangle, ArrowRight, PackageOpen } from "lucide-react";
import { type ReactNode } from "react";

import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { cn } from "@/lib/utils";

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

type Modo = "aberto" | "periodo";

/** Bloco "Previstos": CT-e ainda não entregues, por status e por faixa de vencimento. */
export function SecaoPrevistos({
  dados,
  carregando,
  ignorarPeriodo,
  onIgnorarPeriodo,
  onClique,
  rodape,
}: {
  dados: Previstos | undefined;
  carregando: boolean;
  ignorarPeriodo: boolean;
  onIgnorarPeriodo: (v: boolean) => void;
  onClique: (c: CliqueNosPrevistos) => void;
  /** Linha na moldura, sob o bloco (verificação da partição). */
  rodape?: ReactNode;
}) {
  const d = dados ?? VAZIO;
  const porStatus = new Map(d.status.map((s) => [s.key, s]));
  const porFaixa = new Map(d.faixa.map((f) => [f.key, f]));
  const mostrar = (someSeZero: boolean | undefined, b: SomasPrevisto | undefined) =>
    !(someSeZero && (!b || b.qtd === 0));

  return (
    <Painel
      titulo={
        <span className="flex flex-wrap items-center gap-2">
          Previstos
          <span title="Documentos em aberto não têm data de conclusão. O controle válido aqui é 'Todos em aberto / Emitidos no período', ao lado.">
            <SeloStatus tom="neutro" semIcone className="cursor-help font-medium">
              sempre por emissão
            </SeloStatus>
          </span>
        </span>
      }
      descricao={
        <>
          CTRCs ainda não entregues ·{" "}
          {carregando || !dados ? "atualizando…" : `${formatarInteiro(d.total.qtd)} no total`}
          <span className="block text-[12.5px]">
            Sempre por data de emissão; o alternador Emitidos/Data Prevista/Concluídos não afeta
            esta seção.
          </span>
        </>
      }
      icone={PackageOpen}
      barra={
        <Alternador<Modo>
          rotulo="Previstos"
          tamanho="pequeno"
          valor={ignorarPeriodo ? "aberto" : "periodo"}
          aoMudar={(m) => {
            onIgnorarPeriodo(m === "aberto");
          }}
          opcoes={[
            { valor: "aberto", rotulo: "Todos em aberto" },
            {
              valor: "periodo",
              rotulo: (
                <>
                  Emitidos no período<span className="opacity-70">(emissão)</span>
                </>
              ),
            },
          ]}
        />
      }
      rodape={rodape}
    >
      {ignorarPeriodo && (
        <div className="border-b border-border p-4">
          <Aviso tom="info">
            Modo <strong className="font-semibold">Todos em aberto</strong>: mostra todos os CTRCs
            ainda não entregues, inclusive de meses anteriores — este bloco ignora o período
            escolhido no topo da tela. Nesse modo o número{" "}
            <strong className="font-semibold">sai da partição de 100%</strong>: Entregues +
            Finalizado em Sistema + Previstos deixa de fechar com o total de CT-e emitidos do
            período. Use &quot;Emitidos no período&quot; ao lado para voltar à partição fechada.
          </Aviso>
        </div>
      )}

      <div className="grid gap-5 p-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              onClique({ eixo: "total" });
            }}
            className="group flex flex-col rounded-xl border border-border bg-superficie px-4 py-3.5 text-left transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-cartao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex items-start justify-between gap-2">
              <span className="label-xs">Total previstos</span>
              <ArrowRight
                className="h-4 w-4 text-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
            <span className="num-hero mt-2 text-foreground">{formatarInteiro(d.total.qtd)}</span>
            <span className="mt-1 text-[12.5px] text-muted-foreground">
              {formatarPeso(d.total.peso)} · {formatarInteiro(d.total.volumes)} vol ·{" "}
              {formatarMoeda(d.total.frete, { centavos: false })}
            </span>
          </button>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            A soma das células em cada eixo é igual ao total. Cada célula é clicável e abre a
            listagem detalhada preservando os filtros ativos.
          </p>
        </div>

        <div className="space-y-5">
          <Grupo titulo="Por status da última ocorrência">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
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
          </Grupo>
          <Grupo titulo="Por faixa de vencimento">
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
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
          </Grupo>
        </div>
      </div>
    </Painel>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-semibold text-foreground">{titulo}</div>
      {children}
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
  const qtd = somas?.qtd ?? 0;
  const alarme = perigo && qtd > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-w-0 flex-col rounded-xl border px-3 py-2.5 text-left transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-cartao focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        alarme ? "border-status-bad/30 bg-status-bad-bg" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "flex items-center gap-1 text-[12.5px] font-medium",
          alarme ? "text-status-bad-fg" : "text-muted-foreground",
        )}
      >
        {alarme && <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{rotulo}</span>
      </span>
      <span
        className={cn(
          "mt-1 text-[22px] font-bold tabular-nums",
          alarme ? "text-status-bad-fg" : "text-foreground",
        )}
      >
        {formatarInteiro(qtd)}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatarPeso(somas?.peso ?? 0)} · {formatarInteiro(somas?.volumes ?? 0)} vol
      </span>
    </button>
  );
}
