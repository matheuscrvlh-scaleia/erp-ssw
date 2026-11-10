/**
 * Abas Romaneio de entrega, Performance por romaneio, Performance Motorista/Ajudante e Prejuízo.
 * Visual da tela de hoje (features/romaneio/Fase2Views.tsx).
 */
import { type FiltrosRomaneio, type LinhaPerformancePessoa } from "@erp/shared/contratos/romaneio";
import { formatarData, formatarPercentual } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Lock, Search, X } from "lucide-react";
import { useEffect, useState } from "react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import {
  consultaCtesPorCarro,
  consultaKpis,
  consultaMotivos,
  consultaPerformanceAjudantes,
  consultaPerformanceMotoristas,
  consultaPorViagem,
  consultaPrejuizo,
} from "./api";
import { type Abertura } from "./busca";
import { CardsDoPeriodo, type PropsCardsDoPeriodo } from "./CardsDoPeriodo";
import {
  AtribuicaoLegenda,
  AvisoDoBloco,
  CardAba,
  PrejuizoSubtitulo,
  textoDoPrejuizo,
} from "./componentes";
import { Distribuicao } from "./Distribuicao";
import { fmtDiaCurto, fmtMoedaInteira, fmtPeso, nfInt } from "./formatos";

interface PropsDaAba {
  filtros: FiltrosRomaneio;
  aoAbrir: (a: Abertura) => void;
}

const TIP_RETORNO =
  "CTRC com ocorrência 13 que ainda estão em aberto (nem entregues nem baixados) — acompanhamento do que precisa de ação. Para o total histórico do período, veja a aba Prejuízo.";
const TIP_PERFORMANCE =
  "(CTRC levados − CTRC prejudicados pelo código 13) ÷ CTRC levados × 100. Só a ocorrência 13 (Entrega Prejudicada) entra na conta, qualquer que seja o filtro de código da tela. Ex.: 709 levados e 2 prejudicados = 99,72%.";
const TIP_VIAGENS =
  "Quantas vezes saiu para entrega no período: cada romaneio de entrega conta uma viagem, mesmo quando sai de novo com a mesma placa.";
const TIP_PREJUDICADAS =
  "Cargas com prejuízo atribuído ao(s) código(s) indicado(s) abaixo, no mesmo critério das demais telas. Só aparecem aqui as cargas com motorista identificado no romaneio, então a soma da coluna pode ficar abaixo do total geral.";

const pctDe = (parte: number, todo: number) => (todo > 0 ? (parte / todo) * 100 : null);

// ---------------------------------------------------------------------------------------------
// Aba Romaneio de entrega

export function AbaRomaneioEntrega({ filtros, aoAbrir }: PropsDaAba) {
  const kpis = useQuery(consultaKpis(filtros));
  const carros = useQuery(consultaCtesPorCarro(filtros));
  const linhas = carros.data ?? [];
  const maior = Math.max(1, ...linhas.map((c) => c.ctes));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CardAba
          rotulo="CTRC no período"
          valor={kpis.data ? nfInt.format(kpis.data.total) : "—"}
          dica="Base do período filtrado"
          explicacao="Todas as cargas do período e dos filtros escolhidos, sem as canceladas no mesmo dia. É a base dos percentuais desta aba."
          aoClicar={() => {
            aoAbrir({ recorte: "todos" });
          }}
        />
      </div>
      <div className="rounded-[10px] border border-border/70 bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1 text-[13px] font-medium">
            CTRC por carro
            <InfoTip texto="Todas as placas que levaram cargas para entrega no período, da que mais levou para a que menos levou. Com a base “saída para entrega”, a placa vem do próprio romaneio do dia (036). CT-e que contam como saída sem romaneio de veículo próprio (entrega por parceiro, agência ou baixa administrativa) ficam na última linha, “Sem placa identificada”. Clique numa placa para ver as cargas daquele veículo." />
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {linhas.length > 0
                ? `${nfInt.format(linhas.filter((c) => c.placa).length)} placas · `
                : ""}
              CTRC · peso · vol. · frete
            </span>
            <ExportMenu
              arquivo="romaneio-ctrc-por-carro"
              titulo="CTRC por carro"
              colunas={[
                { chave: "placaExibida", titulo: "Placa" },
                { chave: "motorista", titulo: "Motorista" },
                { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
                { chave: "peso", titulo: "Peso (kg)", formato: "decimal" },
                { chave: "volumes", titulo: "Volumes", formato: "inteiro" },
                { chave: "frete", titulo: "Frete", formato: "moeda" },
              ]}
              linhas={linhas.map((c) => ({
                ...c,
                placaExibida: c.placa ?? "Sem placa identificada",
              }))}
              soIcone
            />
          </div>
        </div>
        {carros.isLoading && <AvisoDoBloco>carregando…</AvisoDoBloco>}
        {!carros.isLoading && linhas.length === 0 && (
          <AvisoDoBloco>Nenhum carro com saída para entrega no período.</AvisoDoBloco>
        )}
        <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
          {linhas.map((c) => {
            const placa = c.placa;
            return (
              <div
                key={placa ?? "__sem_placa__"}
                {...(placa
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      onClick: () => {
                        aoAbrir({ placa });
                      },
                    }
                  : {
                      title:
                        "CT-e que contam como saída para entrega sem romaneio de veículo próprio no período (entrega por parceiro, agência ou baixa administrativa).",
                    })}
                className={cn(
                  "flex items-center gap-2 rounded text-[12px]",
                  placa && "cursor-pointer hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "w-24 shrink-0 text-[11px]",
                    placa ? "font-mono" : "italic text-muted-foreground",
                  )}
                >
                  {placa ?? "Sem placa identificada"}
                </span>
                <span className="w-40 shrink-0 truncate text-muted-foreground">
                  {c.motorista ?? "—"}
                </span>
                <div className="h-3 flex-1 rounded-sm bg-muted">
                  <div
                    className="h-3 rounded-sm bg-[var(--brand)]"
                    style={{ width: `${(c.ctes / maior) * 100}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right tabular-nums" title="CTRC">
                  {nfInt.format(c.ctes)}
                </span>
                <span
                  className="hidden w-20 shrink-0 text-right tabular-nums text-muted-foreground sm:inline"
                  title="Peso"
                >
                  {c.peso ? fmtPeso(c.peso) : "—"}
                </span>
                <span
                  className="hidden w-14 shrink-0 text-right tabular-nums text-muted-foreground sm:inline"
                  title="Volumes"
                >
                  {nfInt.format(c.volumes)}
                </span>
                <span
                  className="w-24 shrink-0 text-right tabular-nums text-muted-foreground"
                  title="Frete"
                >
                  {fmtMoedaInteira(c.frete)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Aba Performance por romaneio

const HORAS = Array.from({ length: 24 }, (_, h) => h);

/** Frete perdido por horário (período de um dia) ou por dia (período maior). */
function FretePerdidoPorHora({
  porHora,
  porDia,
  diaUnico,
  carregando,
}: {
  porHora: readonly { hora: number; ctes: number; frete: number }[];
  porDia: readonly { dia: string; ctes: number; frete: number }[];
  diaUnico: boolean;
  carregando: boolean;
}) {
  const horas = HORAS.map(
    (h) => porHora.find((l) => l.hora === h) ?? { hora: h, ctes: 0, frete: 0 },
  );
  const pontos = diaUnico
    ? horas.map((h) => ({
        chave: String(h.hora),
        rotulo: h.hora % 3 === 0 ? String(h.hora) : "",
        titulo: `${h.hora}h`,
        ...h,
      }))
    : porDia.map((d) => ({
        chave: d.dia,
        rotulo: fmtDiaCurto(d.dia),
        titulo: formatarData(d.dia),
        ...d,
      }));
  const maior = Math.max(1, ...pontos.map((p) => p.frete));
  const total = pontos.reduce((s, p) => s + p.frete, 0);
  return (
    <div className="rounded-[10px] border border-border/70 bg-card p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>{diaUnico ? "Frete perdido por horário" : "Frete perdido por dia"}</span>
        <InfoTip
          texto={
            diaUnico
              ? "Frete das cargas prejudicadas, agrupado pela hora em que a ocorrência penalizante foi registrada. Mostra em que faixa de horário o prejuízo mais se concentra."
              : "Frete das cargas prejudicadas, agrupado pelo dia de emissão do CTRC (mesma base do gráfico Prejuízo por dia). Mostra em que dia do período o prejuízo mais se concentra. Filtre um único dia para ver por horário."
          }
        />
      </div>
      {carregando && <AvisoDoBloco>carregando…</AvisoDoBloco>}
      {!carregando && total === 0 && (
        <AvisoDoBloco>Nenhum prejuízo registrado no período.</AvisoDoBloco>
      )}
      {!carregando && total > 0 && (
        <div className={cn("mt-3 flex h-[100px] items-end", diaUnico ? "gap-[2px]" : "gap-1")}>
          {pontos.map((p) => (
            <div
              key={p.chave}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
              title={`${p.titulo} · ${fmtMoedaInteira(p.frete)} · ${nfInt.format(p.ctes)} carga(s)`}
            >
              <div
                className="w-full rounded-t bg-destructive/70 transition-colors group-hover:bg-destructive"
                style={{
                  height: `${Math.max(p.frete > 0 ? 3 : 0, (p.frete / maior) * 100)}%`,
                }}
              />
              <span className="w-full truncate text-center text-[9px] text-muted-foreground">
                {p.rotulo}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AbaPerformanceRomaneio({
  filtros,
  aoAbrir,
  cards,
  nomeCurto,
}: PropsDaAba & { cards: PropsCardsDoPeriodo; nomeCurto: string }) {
  const q = useQuery(consultaKpis(filtros));
  const prejuizo = useQuery(consultaPrejuizo(filtros));
  const k = q.data;
  const base = k?.romaneado ?? 0;
  const pctBase = (n: number) =>
    base > 0 ? `${formatarPercentual((n / base) * 100, { escala: "cem" })} da base desta aba` : "—";
  const positiva = k ? pctDe(k.entregue, base) : null;
  const pPrejuizo = k ? pctDe(k.prejudicada, base) : null;
  const codigos = filtros.codigos;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        {k
          ? `Base desta aba: ${nfInt.format(base)} cargas que já saíram para entrega (de ${nfInt.format(k.total)} do período).`
          : "Base desta aba: cargas que já saíram para entrega."}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CardAba
          rotulo="CTRC romaneados"
          valor={k ? nfInt.format(base) : "—"}
          dica="Cargas que já saíram para entrega no período"
          explicacao="Base desta aba: cargas com saída para entrega registrada, dentro do período e filtros escolhidos."
        />
        <CardAba
          rotulo="Entregues"
          valor={k ? nfInt.format(k.entregue) : "—"}
          dica={k ? `de ${nfInt.format(base)} romaneados` : undefined}
          tom="ok"
          explicacao="Das cargas que já saíram para entrega, quantas foram entregues ao destinatário. Esta aba conta só quem já saiu para entrega — por isso o número é menor que o da tela de Performance, que conta todos os CTRCs do período."
          aoClicar={() => {
            aoAbrir({ recorte: "entregues" });
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CardAba
          rotulo="Entregas prejudicadas"
          sub={<PrejuizoSubtitulo codigos={codigos} />}
          valor={k ? nfInt.format(k.prejudicada) : "—"}
          dica={k ? pctBase(k.prejudicada) : undefined}
          tom="alerta"
          explicacao="Cargas com prejuízo atribuído ao(s) código(s) indicado(s) no subtítulo. Usa a base completa de romaneados do período — o mesmo número da aba Prejuízo, dos cards do topo e da tela de Performance."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <CardAba
          rotulo="Frete perdido"
          sub={<PrejuizoSubtitulo codigos={codigos} />}
          valor={k ? fmtMoedaInteira(k.fretePerdido) : "—"}
          dica={
            k && k.freteRomaneado > 0
              ? `${formatarPercentual((k.fretePerdido / k.freteRomaneado) * 100, { escala: "cem" })} do frete da base desta aba`
              : undefined
          }
          tom={k && k.fretePerdido > 0 ? "ruim" : undefined}
          explicacao="Frete das cargas com prejuízo atribuído ao(s) código(s) indicado(s) no subtítulo. Usa a base completa de romaneados do período — o mesmo valor da aba Prejuízo e da tela de Performance."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <CardAba
          rotulo="Prejuízo (%)"
          sub={<PrejuizoSubtitulo codigos={codigos} />}
          valor={pPrejuizo !== null ? formatarPercentual(pPrejuizo, { escala: "cem" }) : "—"}
          dica={
            k && pPrejuizo !== null
              ? `${nfInt.format(k.prejudicada)} de ${nfInt.format(base)} CTRC prejudicados`
              : undefined
          }
          tom={pPrejuizo !== null && pPrejuizo > 0 ? "alerta" : undefined}
          explicacao="Mesmo cálculo de Entregas prejudicadas, em percentual: cargas com prejuízo atribuído ao(s) código(s) indicado(s) ÷ CTRC total da aba."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <CardAba
          rotulo="Entregas no horário (%)"
          sub={<PrejuizoSubtitulo codigos={codigos} />}
          valor={
            pPrejuizo !== null ? formatarPercentual(100 - pPrejuizo, { escala: "cem" }) : "—"
          }
          dica={
            k && pPrejuizo !== null
              ? `${nfInt.format(base - k.prejudicada)} de ${nfInt.format(base)} CTRC no horário`
              : undefined
          }
          tom={pPrejuizo !== null && 100 - pPrejuizo >= 95 ? "ok" : undefined}
          explicacao="Contraponto de Prejuízo (%): cargas sem prejuízo atribuído ao(s) código(s) indicado(s) ÷ CTRC total da aba. 100% − Prejuízo (%)."
        />
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <CardAba
          destaque
          rotulo="Não entregues"
          tom="ruim"
          valor={k ? nfInt.format(k.naoEntregue) : "—"}
          dica={k ? pctBase(k.naoEntregue) : undefined}
          explicacao="Cargas que saíram para entrega e até agora não foram entregues. Esta aba conta só quem já saiu para entrega — por isso o número é menor que o da tela de Performance, que conta todos os CTRCs do período."
          aoClicar={() => {
            aoAbrir({ recorte: "em_rota", status: "andamento" });
          }}
        />
        <CardAba
          destaque
          rotulo="Performance positiva"
          tom="ok"
          valor={positiva !== null ? formatarPercentual(positiva, { escala: "cem" }) : "—"}
          dica={
            k && positiva !== null
              ? `${nfInt.format(k.entregue)} de ${nfInt.format(base)} entregues`
              : undefined
          }
          explicacao="Entregues ÷ CTRC total da aba — a mesma Produtividade calculada mais abaixo."
        />
        <CardAba
          destaque
          rotulo="Performance negativa"
          tom="ruim"
          valor={
            positiva !== null ? formatarPercentual(100 - positiva, { escala: "cem" }) : "—"
          }
          dica={
            k && positiva !== null
              ? `${nfInt.format(base - k.entregue)} de ${nfInt.format(base)} não entregues`
              : undefined
          }
          explicacao="Contraponto da Performance positiva: 100% − Performance positiva."
        />
      </div>
      <FretePerdidoPorHora
        porHora={prejuizo.data?.porHora ?? []}
        porDia={prejuizo.data?.porDia ?? []}
        diaUnico={filtros.inicio === filtros.fim}
        carregando={prejuizo.isLoading}
      />
      <AtribuicaoLegenda codigos={codigos} />
      {/* Totalizadores do período: nesta aba ficam aqui embaixo, a pedido do cliente. */}
      <CardsDoPeriodo {...cards} />
      <p className="text-[11px] text-muted-foreground">
        Entregues e Não entregues consideram as cargas que já saíram para entrega. O card CTRC conta
        todo o período (inclusive o que ainda não saiu), por isso é maior que os cards de cima.
        Prejuízo usa a base completa de romaneados, igual às demais telas. Uma carga entra na base
        de saída quando há registro de saída do veículo, confirmação de entrega, algum evento de rua
        (tentativa, recusa, retorno, cliente ausente e afins) ou comprovante de entrega recebido —
        não só o registro formal de saída, que muitas vezes não é lançado.
      </p>
      <Distribuicao filtros={filtros} nomeCurto={nomeCurto} aoAbrir={aoAbrir} />
      <TabelaPorViagem filtros={filtros} aoAbrir={aoAbrir} />
    </div>
  );
}

/** Uma linha por romaneio real (viagem), do relatório 036. */
function TabelaPorViagem({ filtros, aoAbrir }: PropsDaAba) {
  const [texto, setTexto] = useState("");
  const [busca, setBusca] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setBusca(texto.trim());
    }, 400);
    return () => {
      clearTimeout(t);
    };
  }, [texto]);
  const q = useQuery(consultaPorViagem(filtros, busca));
  const linhas = (q.data ?? []).map((r) => ({
    ...r,
    ajudantes: [r.ajudante, r.ajudante2, r.ajudante3].filter((a): a is string => !!a).join(", "),
  }));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[12px] font-medium">
          <span>Por romaneio (viagem real)</span>
          <InfoTip texto="Cada linha é um romaneio de entrega do sistema, com o motorista, os ajudantes e a placa que efetivamente saíram naquela viagem. Só aparecem as cargas que estão dentro dos filtros escolhidos." />
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu
            arquivo="romaneio-por-viagem"
            titulo="Por romaneio (viagem real)"
            colunas={[
              { chave: "romaneio", titulo: "Romaneio" },
              { chave: "dataRomaneio", titulo: "Data", formato: "data" },
              { chave: "situacao", titulo: "Situação" },
              { chave: "placa", titulo: "Placa" },
              { chave: "motorista", titulo: "Motorista" },
              { chave: "ajudantes", titulo: "Ajudantes" },
              { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
              { chave: "transferidas", titulo: "Remanejadas", formato: "inteiro" },
              { chave: "frete", titulo: "Frete", formato: "moeda" },
              { chave: "entregues", titulo: "Entregues", formato: "inteiro" },
              { chave: "naoEntregues", titulo: "Não entregues", formato: "inteiro" },
              { chave: "performanceFracao", titulo: "Performance", formato: "percentual" },
              { chave: "fretePerdido", titulo: "Frete perdido", formato: "moeda" },
            ]}
            linhas={linhas.map((r) => ({
              ...r,
              performanceFracao: r.performance === null ? null : r.performance / 100,
            }))}
            soIcone
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
              }}
              placeholder="Buscar romaneio..."
              aria-label="Buscar por número do romaneio"
              className="h-[26px] w-[190px] rounded-md border border-border/70 bg-background pl-7 pr-6 text-[12px] outline-none focus:border-[var(--brand)]"
            />
            {texto.length > 0 && (
              <button
                type="button"
                aria-label="Limpar busca de romaneio"
                onClick={() => {
                  setTexto("");
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
      <FiltrandoPor
        etiquetas={[
          busca && {
            rotulo: "Romaneio",
            valor: busca,
            limpar: () => {
              setTexto("");
              setBusca("");
            },
          },
        ]}
      />
      <div className="overflow-x-auto rounded-[10px] border border-border/70 bg-card">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="border-b border-border/70">
              <th className="px-3 py-1.5 text-left font-normal">Romaneio</th>
              <th className="px-3 py-1.5 text-left font-normal">Data</th>
              <th className="px-3 py-1.5 text-left font-normal">Situação</th>
              <th className="px-3 py-1.5 text-left font-normal">Placa</th>
              <th className="px-3 py-1.5 text-left font-normal">Motorista</th>
              <th className="px-3 py-1.5 text-left font-normal">Ajudantes</th>
              <th className="px-3 py-1.5 text-right font-normal">CTRC</th>
              <th className="px-3 py-1.5 text-right font-normal">
                <span className="inline-flex items-center gap-1">
                  Remanejadas
                  <InfoTip texto="Cargas que saíram neste romaneio e saíram de novo em outra viagem depois. Elas contam na coluna CTRC deste romaneio como não entregues; a entrega conta na viagem em que aconteceu." />
                </span>
              </th>
              <th className="px-3 py-1.5 text-right font-normal">Frete que saiu</th>
              <th className="px-3 py-1.5 text-right font-normal">Entregues</th>
              <th className="px-3 py-1.5 text-right font-normal">Não entregues</th>
              <th className="px-3 py-1.5 text-right font-normal">Performance</th>
              <th className="px-3 py-1.5 text-right font-normal">
                Frete perdido
                <div className="leading-tight">
                  <PrejuizoSubtitulo codigos={filtros.codigos} />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">
                  carregando…
                </td>
              </tr>
            )}
            {!q.isLoading && linhas.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-10 text-center text-muted-foreground">
                  {busca
                    ? `Nenhum romaneio encontrado para "${busca}" no período e filtros escolhidos.`
                    : "Nenhum romaneio importado para o período e filtros escolhidos."}
                </td>
              </tr>
            )}
            {linhas.map((r) => {
              const placa = r.placa;
              return (
                <tr
                  key={r.romaneio}
                  {...(placa
                    ? {
                        onClick: () => {
                          aoAbrir({ placa });
                        },
                      }
                    : {})}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    placa && "cursor-pointer hover:bg-muted/40",
                  )}
                >
                  <td className="px-3 py-1 font-mono text-[11px]">{r.romaneio}</td>
                  <td className="px-3 py-1">{formatarData(r.dataRomaneio)}</td>
                  <td className="px-3 py-1">{r.situacao ?? "—"}</td>
                  <td className="px-3 py-1 font-mono text-[11px]">{placa ?? "—"}</td>
                  <td className="px-3 py-1">{r.motorista ?? "—"}</td>
                  <td className="px-3 py-1 text-[11px] text-muted-foreground">
                    {r.ajudantes || "—"}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{nfInt.format(r.ctes)}</td>
                  <td className="px-3 py-1 text-right tabular-nums text-muted-foreground">
                    {r.transferidas > 0 ? nfInt.format(r.transferidas) : "—"}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">{fmtMoedaInteira(r.frete)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{nfInt.format(r.entregues)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {nfInt.format(r.naoEntregues)}
                  </td>
                  <td className="px-3 py-1 text-right font-medium tabular-nums">
                    {r.performance !== null
                      ? formatarPercentual(r.performance, { escala: "cem" })
                      : "—"}
                  </td>
                  <td className="px-3 py-1 text-right tabular-nums">
                    {r.fretePerdido > 0 ? fmtMoedaInteira(r.fretePerdido) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {busca
          ? `${nfInt.format(linhas.length)} romaneio(s) encontrado(s) para "${busca}".`
          : "Mostra até 300 romaneios, dos maiores para os menores."}{" "}
        Clique em uma linha para abrir as cargas daquela placa.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Abas Performance Motorista e Ajudante

/** Produtividade (entregues ÷ total da aba) e Taxa de retorno (código 13 em aberto). */
function Produtividade({ linhas }: { linhas: readonly LinhaPerformancePessoa[] }) {
  const entregues = linhas.reduce((s, r) => s + r.entregues, 0);
  const total = linhas.reduce((s, r) => s + r.romaneados, 0);
  const retornos = linhas.reduce((s, r) => s + r.retornos, 0);
  const pct = pctDe(entregues, total);
  const pctRetorno = pctDe(retornos, total);
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground">
        Base desta aba: {nfInt.format(total)} CTRC no total — {nfInt.format(entregues)} entregues.
        Cargas ainda em rota contam contra a produtividade até terem desfecho.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <CardAba
          rotulo="Produtividade"
          valor={pct !== null ? formatarPercentual(pct, { escala: "cem" }) : "—"}
          dica={
            pct !== null
              ? `${nfInt.format(entregues)} de ${nfInt.format(total)} CTRC entregues`
              : undefined
          }
          tom={pct !== null && pct >= 95 ? "ok" : undefined}
          explicacao="Entregues ÷ CTRC total da aba (entregues + não entregues/em rota + finalizado em sistema). Cargas em rota contam contra até terem desfecho."
        />
        <CardAba
          rotulo="Taxa de retorno"
          valor={pctRetorno !== null ? formatarPercentual(pctRetorno, { escala: "cem" }) : "—"}
          dica={
            pctRetorno !== null
              ? `${nfInt.format(retornos)} CTRC sem entrega · de ${nfInt.format(total)} da aba`
              : undefined
          }
          tom={retornos > 0 ? "ruim" : undefined}
          explicacao={TIP_RETORNO}
        />
      </div>
    </div>
  );
}

/** Cabeçalho "Placas" com o olho (só para quem tem a permissão Romaneio · Ver placa). */
function CabecalhoPlaca({
  pode,
  visivel,
  aoAlternar,
}: {
  pode: boolean;
  visivel: boolean;
  aoAlternar: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      Placas
      {pode ? (
        <button
          type="button"
          onClick={aoAlternar}
          aria-label={visivel ? "Ocultar placas" : "Mostrar placas"}
          title={visivel ? "Ocultar placas" : "Mostrar placas"}
          className="rounded p-0.5 hover:bg-muted hover:text-foreground"
        >
          {visivel ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
      ) : (
        <span title="Placa disponível só para quem tem a permissão “Romaneio · Ver placa”.">
          <Lock className="h-3 w-3" />
        </span>
      )}
    </span>
  );
}

function TabelaDePessoas({
  tipo,
  filtros,
  podeVerPlaca,
  aoAbrir,
}: PropsDaAba & { tipo: "motorista" | "ajudante"; podeVerPlaca: boolean }) {
  const consulta =
    tipo === "motorista"
      ? consultaPerformanceMotoristas(filtros)
      : consultaPerformanceAjudantes(filtros);
  const q = useQuery(consulta);
  const linhas = q.data ?? [];
  const [placaVisivel, setPlacaVisivel] = useState(false);
  const mostrarPlaca = podeVerPlaca && placaVisivel;
  const ehMotorista = tipo === "motorista";
  const titulo = ehMotorista ? "Motorista" : "Ajudante";
  const colunas = 7 + (ehMotorista ? 1 : 0);
  return (
    <div className="space-y-3">
      <AtribuicaoLegenda codigos={filtros.codigos} />
      <Produtividade linhas={linhas} />
      <div className="flex items-center justify-end">
        <ExportMenu
          arquivo={`romaneio-${tipo}`}
          titulo={`Performance por ${tipo}`}
          colunas={[
            { chave: "nome", titulo },
            // Placa só sai na exportação para quem tem a permissão.
            ...(podeVerPlaca ? [{ chave: "placas", titulo: "Placas" }] : []),
            ...(ehMotorista ? [{ chave: "equipe", titulo: "Equipe" }] : []),
            { chave: "viagens", titulo: "Qtd. viagens", formato: "inteiro" },
            { chave: "romaneados", titulo: "CTRC — levados", formato: "inteiro" },
            { chave: "entregues", titulo: "CTRC — entregues", formato: "inteiro" },
            { chave: "prejudicadas", titulo: "CTRC — prejudicadas", formato: "inteiro" },
            { chave: "prejudicadas13", titulo: "Prejudicadas (cód. 13)", formato: "inteiro" },
            { chave: "performanceFracao", titulo: "% Performance", formato: "percentual" },
          ]}
          linhas={linhas.map((r) => ({
            ...r,
            performanceFracao: r.romaneados > 0 ? r.performance / 100 : null,
          }))}
          soIcone
        />
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-border/70 bg-card">
        <table className="w-full text-[12px]">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr className="border-b border-border/70">
              <th className="px-3 py-1.5 text-left font-normal">
                {ehMotorista ? (
                  titulo
                ) : (
                  <span className="inline-flex items-center gap-1">
                    Ajudante
                    <InfoTip texto="CTRC com mais de um ajudante conta integralmente para cada um; o total desta aba é maior que o número de CTRCs." />
                  </span>
                )}
              </th>
              <th className="px-3 py-1.5 text-left font-normal">
                <CabecalhoPlaca
                  pode={podeVerPlaca}
                  visivel={mostrarPlaca}
                  aoAlternar={() => {
                    setPlacaVisivel((v) => !v);
                  }}
                />
              </th>
              {ehMotorista && <th className="px-3 py-1.5 text-left font-normal">Equipe</th>}
              <th className="px-3 py-1.5 text-right font-normal">
                <span className="inline-flex items-center gap-1">
                  Qtd. viagens
                  <InfoTip texto={TIP_VIAGENS} />
                </span>
              </th>
              <th className="px-3 py-1.5 text-right font-normal">CTRC — levados</th>
              <th className="px-3 py-1.5 text-right font-normal">CTRC — entregues</th>
              <th className="px-3 py-1.5 text-right font-normal">
                <span className="inline-flex items-center gap-1">
                  CTRC — prejudicadas
                  <InfoTip texto={TIP_PREJUDICADAS} />
                </span>
                <div className="leading-tight">
                  <PrejuizoSubtitulo codigos={filtros.codigos} />
                </div>
              </th>
              <th className="px-3 py-1.5 text-right font-normal">
                <span className="inline-flex items-center gap-1">
                  % Performance
                  <InfoTip texto={TIP_PERFORMANCE} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={colunas} className="px-3 py-8 text-center text-muted-foreground">
                  carregando…
                </td>
              </tr>
            )}
            {!q.isLoading && linhas.length === 0 && (
              <tr>
                <td colSpan={colunas} className="px-3 py-10 text-center text-muted-foreground">
                  Nenhum {tipo} com saída para entrega no período.
                </td>
              </tr>
            )}
            {linhas.map((r) => (
              <tr
                key={r.nome}
                {...(ehMotorista
                  ? {
                      onClick: () => {
                        aoAbrir({ motorista: r.nome });
                      },
                    }
                  : {})}
                className={cn(
                  "border-b border-border/40 last:border-0",
                  ehMotorista && "cursor-pointer hover:bg-muted/40",
                )}
              >
                <td className="px-3 py-1">{r.nome}</td>
                <td className="px-3 py-1 font-mono text-[11px] text-muted-foreground">
                  {mostrarPlaca ? (
                    (r.placas ?? "—")
                  ) : (
                    <span aria-label="Placa oculta">•••••••</span>
                  )}
                </td>
                {ehMotorista && <td className="px-3 py-1">{r.equipe ?? "—"}</td>}
                <td className="px-3 py-1 text-right tabular-nums">{nfInt.format(r.viagens)}</td>
                <td className="px-3 py-1 text-right tabular-nums">{nfInt.format(r.romaneados)}</td>
                <td className="px-3 py-1 text-right tabular-nums">{nfInt.format(r.entregues)}</td>
                <td className="px-3 py-1 text-right tabular-nums">
                  {nfInt.format(r.prejudicadas)}
                </td>
                <td
                  className="px-3 py-1 text-right font-medium tabular-nums"
                  title={`${nfInt.format(r.romaneados)} levados − ${nfInt.format(r.prejudicadas13)} prejudicados (cód. 13)`}
                >
                  {r.romaneados > 0
                    ? formatarPercentual(r.performance, { escala: "cem", casas: 2 })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!ehMotorista && (
        <p className="text-[11px] text-muted-foreground">
          O CTRC conta inteiro para cada ajudante listado nele, então o total desta aba não fecha
          com o universo de CTRCs do período.
        </p>
      )}
      <MotivosNaoEntrega filtros={filtros} aoAbrir={aoAbrir} />
    </div>
  );
}

export function AbaPerformanceMotorista(props: PropsDaAba & { podeVerPlaca: boolean }) {
  return <TabelaDePessoas tipo="motorista" {...props} />;
}

export function AbaPerformanceAjudante(props: PropsDaAba & { podeVerPlaca: boolean }) {
  return <TabelaDePessoas tipo="ajudante" {...props} />;
}

/** Principais motivos de não entrega (só pendências do cliente ou da transportadora). */
function MotivosNaoEntrega({ filtros, aoAbrir }: PropsDaAba) {
  const q = useQuery(consultaMotivos(filtros));
  const linhas = q.data ?? [];
  const maior = Math.max(1, ...linhas.map((r) => r.qtd));
  return (
    <div className="rounded-[10px] border border-border/70 bg-card p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span>Motivos de não entrega</span>
        <InfoTip texto="Principais motivos que impediram a entrega no período — pendências do cliente ou da operação. Uma mesma carga pode aparecer em mais de um motivo. Clique num motivo para ver as cargas." />
      </div>
      <div className="text-[10px] text-muted-foreground/80">
        somente ocorrências classificadas como pendência (cliente ou transportadora)
      </div>
      {q.isLoading && <div className="mt-2 text-[12px] text-muted-foreground">carregando…</div>}
      {q.isError && (
        <div className="mt-2 text-[12px] text-[var(--status-bad)]">{mensagemAmigavel(q.error)}</div>
      )}
      {!q.isLoading && !q.isError && linhas.length === 0 && (
        <div className="mt-2 text-[12px] text-muted-foreground">
          Nenhuma ocorrência de insucesso no período.
        </div>
      )}
      <div className="mt-2 space-y-1.5">
        {linhas.map((r) => {
          // 13 (entrega prejudicada) é o motivo acompanhado de perto pela operação.
          const destaque = Number(r.codigo) === 13;
          const codigo = Number(r.codigo);
          return (
            <div
              key={r.codigo}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (Number.isInteger(codigo)) aoAbrir({ codigos: [codigo] });
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12px] hover:bg-muted/50",
                destaque && "bg-destructive/10 font-medium text-destructive",
              )}
            >
              <span
                className={cn(
                  "w-[52px] shrink-0 font-mono text-[11px]",
                  destaque ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {r.codigo}
              </span>
              <span className="min-w-0 flex-1 truncate" title={r.descricao}>
                {r.descricao || "—"}
              </span>
              <div className="h-1.5 w-[120px] shrink-0 rounded bg-muted">
                <div
                  className="h-1.5 rounded"
                  style={{
                    width: `${(r.qtd / maior) * 100}%`,
                    background: destaque ? "var(--destructive)" : "var(--brand)",
                  }}
                />
              </div>
              <span className="w-[52px] shrink-0 text-right tabular-nums">
                {nfInt.format(r.qtd)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Aba Prejuízo

interface LinhaDoRanking {
  nome: string;
  placa: string | null;
  ctes: number;
  frete: number;
  abertura: Abertura;
}

function RankingDoPrejuizo({
  titulo,
  dica,
  linhas,
  carregando,
  arquivo,
  aoAbrir,
}: {
  titulo: string;
  dica: string;
  linhas: readonly LinhaDoRanking[];
  carregando: boolean;
  arquivo: string;
  aoAbrir: (a: Abertura) => void;
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.frete));
  return (
    <div className="rounded-[10px] border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{titulo}</span>
          <InfoTip texto={dica} />
        </div>
        <ExportMenu
          arquivo={arquivo}
          titulo={`Prejuízo — ${titulo}`}
          colunas={[
            { chave: "nome", titulo: "Nome" },
            { chave: "placa", titulo: "Placa" },
            { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
            { chave: "frete", titulo: "Frete", formato: "moeda" },
          ]}
          linhas={linhas}
          soIcone
        />
      </div>
      {carregando && <div className="mt-2 text-[12px] text-muted-foreground">carregando…</div>}
      {!carregando && linhas.length === 0 && (
        <div className="mt-2 text-[12px] text-muted-foreground">Nada a mostrar no período.</div>
      )}
      <div className="mt-2 space-y-1.5">
        {linhas.map((l, i) => (
          <div
            key={`${l.nome}-${i}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              aoAbrir(l.abertura);
            }}
            className="cursor-pointer rounded px-1 py-0.5 text-[12px] hover:bg-muted/50"
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate" title={l.nome}>
                {l.nome}
                {l.placa && (
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    {l.placa}
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-destructive">
                {fmtMoedaInteira(l.frete)}
              </span>
              <span className="w-[44px] shrink-0 text-right tabular-nums text-muted-foreground">
                {nfInt.format(l.ctes)}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 w-full rounded bg-muted">
              <div
                className="h-1.5 rounded bg-destructive/70"
                style={{ width: `${(l.frete / maior) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Aba Prejuízo: frete das cargas prejudicadas por dia e rankings (janela = período, Q14). */
export function AbaPrejuizo({ filtros, aoAbrir }: PropsDaAba) {
  const q = useQuery(consultaPrejuizo(filtros));
  const d = q.data;
  const porDia = d?.porDia ?? [];
  const maior = Math.max(1, ...porDia.map((x) => x.frete));
  const prejuizo: Abertura = { recorte: "prejuizo" };
  const ranking = (
    linhas: readonly { nome: string; placa: string | null; ctes: number; frete: number }[],
    abertura: (nome: string) => Abertura,
  ) => linhas.map((l) => ({ ...l, abertura: abertura(l.nome) }));
  return (
    <div className="space-y-3">
      <AtribuicaoLegenda codigos={filtros.codigos} />
      <p className="rounded-[10px] border border-border/70 bg-card px-3 py-2 text-[12px] text-muted-foreground">
        Prejuízo aqui são as cargas com {textoDoPrejuizo(filtros.codigos)}. Sem filtro de código, o
        padrão é o código 13 (Entrega Prejudicada). Os totais estão no card Prejuízo do topo;
        abaixo, o frete dessas cargas por dia e onde ele se concentra.
      </p>
      <div className="rounded-[10px] border border-border/70 bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <span>Prejuízo por dia</span>
            <InfoTip texto="Valor de frete comprometido em cada dia do período. Passe o mouse para ver a quantidade de cargas." />
          </div>
          <ExportMenu
            arquivo="romaneio-prejuizo-tendencia"
            titulo="Prejuízo por dia"
            colunas={[
              { chave: "dia", titulo: "Dia", formato: "data" },
              { chave: "ctes", titulo: "CTRC", formato: "inteiro" },
              { chave: "frete", titulo: "Frete", formato: "moeda" },
            ]}
            linhas={porDia}
            soIcone
          />
        </div>
        {q.isLoading && <div className="mt-2 text-[12px] text-muted-foreground">carregando…</div>}
        {q.isError && (
          <div className="mt-2 text-[12px] text-[var(--status-bad)]">
            Não foi possível carregar os dados do gráfico. {mensagemAmigavel(q.error)}
          </div>
        )}
        {!q.isLoading && !q.isError && porDia.length === 0 && (
          <div className="mt-2 text-[12px] text-muted-foreground">
            Nenhum prejuízo registrado no período.
          </div>
        )}
        {porDia.length > 0 && (
          <div className="mt-3 flex h-[120px] items-end gap-1">
            {porDia.map((x) => (
              <div
                key={x.dia}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                title={`${formatarData(x.dia)} · ${fmtMoedaInteira(x.frete)} · ${nfInt.format(x.ctes)} carga(s)`}
              >
                <div
                  className="w-full rounded-t bg-destructive/70 transition-colors group-hover:bg-destructive"
                  style={{ height: `${Math.max(2, (x.frete / maior) * 100)}%` }}
                />
                <span className="w-full truncate text-center text-[9px] text-muted-foreground">
                  {fmtDiaCurto(x.dia)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-2 lg:grid-cols-3">
        <RankingDoPrejuizo
          titulo="Cidades"
          dica="Cidades de destino onde o prejuízo se concentra no período."
          carregando={q.isLoading}
          linhas={ranking(d?.cidades ?? [], () => prejuizo)}
          arquivo="romaneio-prejuizo-cidade"
          aoAbrir={aoAbrir}
        />
        <RankingDoPrejuizo
          titulo="Pagadores"
          dica="Clientes pagadores das cargas com prejuízo no período."
          carregando={q.isLoading}
          linhas={ranking(d?.pagadores ?? [], () => prejuizo)}
          arquivo="romaneio-prejuizo-pagador"
          aoAbrir={aoAbrir}
        />
        <RankingDoPrejuizo
          titulo="Motoristas"
          dica="Motoristas e placas envolvidos nas cargas com prejuízo. Clique para ver as cargas do motorista."
          carregando={q.isLoading}
          linhas={ranking(d?.motoristas ?? [], (nome) => ({
            recorte: "prejuizo",
            motorista: nome,
          }))}
          arquivo="romaneio-prejuizo-motorista"
          aoAbrir={aoAbrir}
        />
      </div>
    </div>
  );
}
