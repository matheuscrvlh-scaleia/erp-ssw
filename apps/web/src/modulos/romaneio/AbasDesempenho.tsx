/**
 * Abas Romaneio de entrega, Performance por romaneio, Performance Motorista/Ajudante e Prejuízo.
 * origem: features/romaneio/Fase2Views.tsx (sistema atual)
 */
import { type FiltrosRomaneio, type LinhaPerformancePessoa } from "@erp/shared/contratos/romaneio";
import {
  formatarData,
  formatarDiaMes,
  formatarInteiro,
  formatarMoeda,
  formatarPercentual,
  formatarPeso,
} from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  CalendarClock,
  Car,
  CircleCheck,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Lock,
  type LucideIcon,
  MapPin,
  Percent,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TriangleAlert,
  Truck,
  Undo2,
  UserRound,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { Aviso } from "@/componentes/comum/Aviso";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { GraficoBarras } from "@/componentes/comum/Graficos";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { Skeleton } from "@/componentes/ui/skeleton";
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
  Cabecalho,
  CaixaDeBusca,
  CLASSE_CODIGO,
  CLASSE_NUMERO,
  CLASSE_TD,
  ComDica,
  EstadoDaTabela,
  GradeDeIndicadores,
  Indicador,
  PrejuizoSubtitulo,
  propsDaLinha,
  TabelaPropria,
  textoDoPrejuizo,
  Th,
  TituloComDica,
  Trilho,
} from "./componentes";
import { Distribuicao } from "./Distribuicao";

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

/** Título de bloco com o "i" da explicação ao lado. */
function TituloDoBloco({ dica, children }: { dica: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      <InfoTip texto={dica} />
    </span>
  );
}

/** Lista de barras horizontais carregando (mesma altura das linhas). */
function BarrasCarregando() {
  return (
    <div className="space-y-3 py-1" aria-hidden>
      {[92, 70, 54, 38, 20].map((w) => (
        <Skeleton key={w} className="h-5 rounded-md bg-muted" style={{ width: `${w}%` }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Aba Romaneio de entrega

export function AbaRomaneioEntrega({ filtros, aoAbrir }: PropsDaAba) {
  const kpis = useQuery(consultaKpis(filtros));
  const carros = useQuery(consultaCtesPorCarro(filtros));
  const linhas = carros.data ?? [];
  const maior = Math.max(1, ...linhas.map((c) => c.ctes));
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador
          rotulo="CTRC no período"
          icone={FileText}
          neutro
          status="bom"
          valor={kpis.data ? formatarInteiro(kpis.data.total) : "—"}
          detalhe="Base do período filtrado"
          dica="Todas as cargas do período e dos filtros escolhidos, sem as canceladas no mesmo dia. É a base dos percentuais desta aba."
          aoClicar={() => {
            aoAbrir({ recorte: "todos" });
          }}
        />
      </div>
      <Painel
        icone={Car}
        titulo={
          <TituloDoBloco dica="Todas as placas que levaram cargas para entrega no período, da que mais levou para a que menos levou. Com a base “saída para entrega”, a placa vem do próprio romaneio do dia (036). CT-e que contam como saída sem romaneio de veículo próprio (entrega por parceiro, agência ou baixa administrativa) ficam na última linha, “Sem placa identificada”. Clique numa placa para ver as cargas daquele veículo.">
            CTRC por carro
          </TituloDoBloco>
        }
        descricao={`${
          linhas.length > 0
            ? `${formatarInteiro(linhas.filter((c) => c.placa).length)} placas · `
            : ""
        }CTRC · peso · vol. · frete`}
        acoes={
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
        }
        classeDoCorpo="px-3 py-3"
      >
        {carros.isLoading && <BarrasCarregando />}
        {carros.isError && (
          <MensagemErro erro={carros.error} aoTentarDeNovo={() => void carros.refetch()} />
        )}
        {carros.isSuccess && linhas.length === 0 && (
          <EstadoVazio mensagem="Nenhum carro com saída para entrega no período." />
        )}
        {linhas.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-2 pb-1.5 label-xs" aria-hidden>
              <span className="w-24 shrink-0">Placa</span>
              <span className="hidden w-44 shrink-0 md:inline">Motorista</span>
              <span className="flex-1" />
              <span className="w-14 shrink-0 text-right">CTRC</span>
              <span className="hidden w-20 shrink-0 text-right sm:inline">Peso</span>
              <span className="hidden w-16 shrink-0 text-right sm:inline">Vol.</span>
              <span className="w-24 shrink-0 text-right">Frete</span>
            </div>
            <ul className="rolagem-fina max-h-[520px] space-y-0.5 overflow-y-auto pr-1">
              {linhas.map((c) => {
                const placa = c.placa;
                const resumo = `${formatarInteiro(c.ctes)} CTRC · ${c.peso ? formatarPeso(c.peso, { fixas: true }) : "—"} · ${formatarInteiro(c.volumes)} vol. · ${formatarMoeda(c.frete, { centavos: false })}`;
                const conteudo = (
                  <>
                    <span
                      className={cn(
                        "w-24 shrink-0 text-[12px]",
                        placa ? "font-mono" : "text-muted-foreground italic",
                      )}
                    >
                      {placa ?? "Sem placa identificada"}
                    </span>
                    <span className="hidden w-44 shrink-0 truncate text-muted-foreground md:inline">
                      {c.motorista ?? "—"}
                    </span>
                    <Trilho fracao={c.ctes / maior} className="h-2.5 flex-1" />
                    <span className="w-14 shrink-0 text-right font-semibold tabular-nums">
                      {formatarInteiro(c.ctes)}
                    </span>
                    <span className="hidden w-20 shrink-0 text-right text-muted-foreground tabular-nums sm:inline">
                      {c.peso ? formatarPeso(c.peso, { fixas: true }) : "—"}
                    </span>
                    <span className="hidden w-16 shrink-0 text-right text-muted-foreground tabular-nums sm:inline">
                      {formatarInteiro(c.volumes)}
                    </span>
                    <span className="w-24 shrink-0 text-right text-muted-foreground tabular-nums">
                      {formatarMoeda(c.frete, { centavos: false })}
                    </span>
                  </>
                );
                const classe =
                  "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13px]";
                return (
                  <li key={placa ?? "__sem_placa__"}>
                    {placa ? (
                      <ComDica texto={`${placa} · ${resumo}`}>
                        <button
                          type="button"
                          onClick={() => {
                            aoAbrir({ placa });
                          }}
                          className={cn(classe, "hover:bg-muted/60")}
                        >
                          {conteudo}
                        </button>
                      </ComDica>
                    ) : (
                      <div
                        className={classe}
                        title="CT-e que contam como saída para entrega sem romaneio de veículo próprio no período (entrega por parceiro, agência ou baixa administrativa)."
                      >
                        {conteudo}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Painel>
    </>
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
  const pontos = diaUnico
    ? HORAS.map((h) => {
        const l = porHora.find((x) => x.hora === h) ?? { ctes: 0, frete: 0 };
        return { rotulo: `${h}h`, titulo: `${h}h`, ctes: l.ctes, frete: l.frete };
      })
    : porDia.map((d) => ({
        rotulo: formatarDiaMes(d.dia),
        titulo: formatarData(d.dia),
        ctes: d.ctes,
        frete: d.frete,
      }));
  const total = pontos.reduce((s, p) => s + p.frete, 0);
  return (
    <Painel
      icone={Clock}
      titulo={
        <TituloDoBloco
          dica={
            diaUnico
              ? "Frete das cargas prejudicadas, agrupado pela hora em que a ocorrência penalizante foi registrada. Mostra em que faixa de horário o prejuízo mais se concentra."
              : "Frete das cargas prejudicadas, agrupado pelo dia de emissão do CTRC (mesma base do gráfico Prejuízo por dia). Mostra em que dia do período o prejuízo mais se concentra. Filtre um único dia para ver por horário."
          }
        >
          {diaUnico ? "Frete perdido por horário" : "Frete perdido por dia"}
        </TituloDoBloco>
      }
    >
      {!carregando && total === 0 ? (
        <EstadoVazio mensagem="Nenhum prejuízo registrado no período." />
      ) : (
        <GraficoBarras
          dados={pontos}
          eixoX="rotulo"
          series={[{ chave: "frete", nome: "Frete perdido", cor: "var(--status-bad)" }]}
          formato="inteiro"
          altura={200}
          carregando={carregando}
          descricao={diaUnico ? "Frete perdido por horário" : "Frete perdido por dia"}
          dica={(p) => <DicaDoPrejuizo titulo={p.titulo} frete={p.frete} ctes={p.ctes} />}
        />
      )}
    </Painel>
  );
}

/** Dica do gráfico de prejuízo: dia/hora, frete e quantidade de cargas. */
function DicaDoPrejuizo({ titulo, frete, ctes }: { titulo: string; frete: number; ctes: number }) {
  return (
    <>
      <div className="label-xs mb-1.5">{titulo}</div>
      <div className="flex items-center gap-2 tabular-nums">
        <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-status-bad" />
        <strong className="font-semibold text-foreground">
          {formatarMoeda(frete, { centavos: false })}
        </strong>
        <span className="text-muted-foreground">· {formatarInteiro(ctes)} carga(s)</span>
      </div>
    </>
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
  const prejuizoDe = (resto: string | undefined) =>
    [textoDoPrejuizo(codigos), resto].filter(Boolean).join(" · ");
  return (
    <>
      <AtribuicaoLegenda codigos={codigos} />
      <p className="text-[13px] text-muted-foreground">
        {k
          ? `Base desta aba: ${formatarInteiro(base)} cargas que já saíram para entrega (de ${formatarInteiro(k.total)} do período).`
          : "Base desta aba: cargas que já saíram para entrega."}
      </p>
      <GradeDeIndicadores max={5}>
        <Indicador
          rotulo="CTRC romaneados"
          icone={Truck}
          neutro
          status="bom"
          valor={k ? formatarInteiro(base) : "—"}
          detalhe="Cargas que já saíram para entrega no período"
          dica="Base desta aba: cargas com saída para entrega registrada, dentro do período e filtros escolhidos."
        />
        <Indicador
          rotulo="Entregues"
          icone={CircleCheck}
          neutro
          status="bom"
          valor={k ? formatarInteiro(k.entregue) : "—"}
          detalhe={k ? `de ${formatarInteiro(base)} romaneados` : ""}
          dica="Das cargas que já saíram para entrega, quantas foram entregues ao destinatário. Esta aba conta só quem já saiu para entrega — por isso o número é menor que o da tela de Performance, que conta todos os CTRCs do período."
          aoClicar={() => {
            aoAbrir({ recorte: "entregues" });
          }}
        />
        <Indicador
          rotulo="Não entregues"
          icone={CircleX}
          neutro
          status="ruim"
          valor={k ? formatarInteiro(k.naoEntregue) : "—"}
          detalhe={k ? pctBase(k.naoEntregue) : ""}
          dica="Cargas que saíram para entrega e até agora não foram entregues. Esta aba conta só quem já saiu para entrega — por isso o número é menor que o da tela de Performance, que conta todos os CTRCs do período."
          aoClicar={() => {
            aoAbrir({ recorte: "em_rota", status: "andamento" });
          }}
        />
        <Indicador
          rotulo="Performance positiva"
          icone={ThumbsUp}
          neutro
          status="bom"
          valor={positiva !== null ? formatarPercentual(positiva, { escala: "cem" }) : "—"}
          detalhe={
            k && positiva !== null
              ? `${formatarInteiro(k.entregue)} de ${formatarInteiro(base)} entregues`
              : ""
          }
          dica="Entregues ÷ CTRC total da aba — a mesma Produtividade calculada mais abaixo."
          progresso={positiva !== null ? positiva / 100 : undefined}
        />
        <Indicador
          rotulo="Performance negativa"
          icone={ThumbsDown}
          neutro
          status="ruim"
          valor={positiva !== null ? formatarPercentual(100 - positiva, { escala: "cem" }) : "—"}
          detalhe={
            k && positiva !== null
              ? `${formatarInteiro(base - k.entregue)} de ${formatarInteiro(base)} não entregues`
              : ""
          }
          dica="Contraponto da Performance positiva: 100% − Performance positiva."
        />
      </GradeDeIndicadores>
      <GradeDeIndicadores>
        <Indicador
          rotulo="Entregas prejudicadas"
          icone={TriangleAlert}
          neutro
          status="alerta"
          valor={k ? formatarInteiro(k.prejudicada) : "—"}
          detalhe={prejuizoDe(k ? pctBase(k.prejudicada) : undefined)}
          dica="Cargas com prejuízo atribuído ao(s) código(s) indicado(s) no subtítulo. Usa a base completa de romaneados do período — o mesmo número da aba Prejuízo, dos cards do topo e da tela de Performance."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <Indicador
          rotulo="Frete perdido"
          icone={Banknote}
          neutro={!(k && k.fretePerdido > 0)}
          status="ruim"
          valor={k ? formatarMoeda(k.fretePerdido, { centavos: false }) : "—"}
          detalhe={prejuizoDe(
            k && k.freteRomaneado > 0
              ? `${formatarPercentual((k.fretePerdido / k.freteRomaneado) * 100, { escala: "cem" })} do frete da base desta aba`
              : undefined,
          )}
          dica="Frete das cargas com prejuízo atribuído ao(s) código(s) indicado(s) no subtítulo. Usa a base completa de romaneados do período — o mesmo valor da aba Prejuízo e da tela de Performance."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <Indicador
          rotulo="Prejuízo (%)"
          icone={Percent}
          neutro={!(pPrejuizo !== null && pPrejuizo > 0)}
          status="alerta"
          valor={pPrejuizo !== null ? formatarPercentual(pPrejuizo, { escala: "cem" }) : "—"}
          detalhe={prejuizoDe(
            k && pPrejuizo !== null
              ? `${formatarInteiro(k.prejudicada)} de ${formatarInteiro(base)} CTRC prejudicados`
              : undefined,
          )}
          dica="Mesmo cálculo de Entregas prejudicadas, em percentual: cargas com prejuízo atribuído ao(s) código(s) indicado(s) ÷ CTRC total da aba."
          aoClicar={() => {
            aoAbrir({ recorte: "prejuizo" });
          }}
        />
        <Indicador
          rotulo="Entregas no horário (%)"
          icone={CalendarClock}
          neutro={!(pPrejuizo !== null && 100 - pPrejuizo >= 95)}
          status="bom"
          valor={pPrejuizo !== null ? formatarPercentual(100 - pPrejuizo, { escala: "cem" }) : "—"}
          detalhe={prejuizoDe(
            k && pPrejuizo !== null
              ? `${formatarInteiro(base - k.prejudicada)} de ${formatarInteiro(base)} CTRC no horário`
              : undefined,
          )}
          dica="Contraponto de Prejuízo (%): cargas sem prejuízo atribuído ao(s) código(s) indicado(s) ÷ CTRC total da aba. 100% − Prejuízo (%)."
        />
      </GradeDeIndicadores>
      <FretePerdidoPorHora
        porHora={prejuizo.data?.porHora ?? []}
        porDia={prejuizo.data?.porDia ?? []}
        diaUnico={filtros.inicio === filtros.fim}
        carregando={prejuizo.isLoading}
      />
      {/* Totalizadores do período: nesta aba ficam aqui embaixo, a pedido do cliente. */}
      <CardsDoPeriodo {...cards} />
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        Entregues e Não entregues consideram as cargas que já saíram para entrega. O card CTRC conta
        todo o período (inclusive o que ainda não saiu), por isso é maior que os cards de cima.
        Prejuízo usa a base completa de romaneados, igual às demais telas. Uma carga entra na base
        de saída quando há registro de saída do veículo, confirmação de entrega, algum evento de rua
        (tentativa, recusa, retorno, cliente ausente e afins) ou comprovante de entrega recebido —
        não só o registro formal de saída, que muitas vezes não é lançado.
      </p>
      <Distribuicao filtros={filtros} nomeCurto={nomeCurto} aoAbrir={aoAbrir} />
      <TabelaPorViagem filtros={filtros} aoAbrir={aoAbrir} />
    </>
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
    <Painel
      icone={Truck}
      titulo={
        <TituloDoBloco dica="Cada linha é um romaneio de entrega do sistema, com o motorista, os ajudantes e a placa que efetivamente saíram naquela viagem. Só aparecem as cargas que estão dentro dos filtros escolhidos.">
          Por romaneio (viagem real)
        </TituloDoBloco>
      }
      acoes={
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
      }
      barra={
        <>
          <CaixaDeBusca
            valor={texto}
            aoMudar={setTexto}
            placeholder="Buscar romaneio..."
            rotulo="Buscar por número do romaneio"
            ativo={busca !== ""}
            className="w-[220px]"
          >
            {texto.length > 0 && (
              <button
                type="button"
                aria-label="Limpar busca de romaneio"
                title="Limpar busca de romaneio"
                onClick={() => {
                  setTexto("");
                }}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </CaixaDeBusca>
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
        </>
      }
      rodape={
        <span>
          {busca
            ? `${formatarInteiro(linhas.length)} romaneio(s) encontrado(s) para "${busca}".`
            : "Mostra até 300 romaneios, dos maiores para os menores."}{" "}
          Clique em uma linha para abrir as cargas daquela placa.
        </span>
      }
    >
      <TabelaPropria>
        <Cabecalho>
          <Th>Romaneio</Th>
          <Th>Data</Th>
          <Th>Situação</Th>
          <Th>Placa</Th>
          <Th>Motorista</Th>
          <Th>Ajudantes</Th>
          <Th direita>CTRC</Th>
          <Th direita>
            <TituloComDica dica="Cargas que saíram neste romaneio e saíram de novo em outra viagem depois. Elas contam na coluna CTRC deste romaneio como não entregues; a entrega conta na viagem em que aconteceu.">
              Remanejadas
            </TituloComDica>
          </Th>
          <Th direita>Frete que saiu</Th>
          <Th direita>Entregues</Th>
          <Th direita>Não entregues</Th>
          <Th direita>Performance</Th>
          <Th direita>
            Frete perdido
            <PrejuizoSubtitulo codigos={filtros.codigos} />
          </Th>
        </Cabecalho>
        <tbody>
          <EstadoDaTabela
            colunas={13}
            carregando={q.isLoading}
            erro={q.error}
            aoTentarDeNovo={() => void q.refetch()}
            vazio={linhas.length === 0}
            mensagem={
              busca
                ? `Nenhum romaneio encontrado para "${busca}" no período e filtros escolhidos.`
                : "Nenhum romaneio importado para o período e filtros escolhidos."
            }
          />
          {linhas.map((r) => {
            const placa = r.placa;
            return (
              <tr
                key={r.romaneio}
                {...propsDaLinha(
                  placa
                    ? () => {
                        aoAbrir({ placa });
                      }
                    : undefined,
                )}
              >
                <td className={CLASSE_CODIGO}>{r.romaneio}</td>
                <td className={`${CLASSE_TD} whitespace-nowrap`}>{formatarData(r.dataRomaneio)}</td>
                <td className={CLASSE_TD}>{r.situacao ?? "—"}</td>
                <td className={CLASSE_CODIGO}>{placa ?? "—"}</td>
                <td className={CLASSE_TD}>{r.motorista ?? "—"}</td>
                <td className={`${CLASSE_TD} text-muted-foreground`}>{r.ajudantes || "—"}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.ctes)}</td>
                <td className={`${CLASSE_NUMERO} text-muted-foreground`}>
                  {r.transferidas > 0 ? formatarInteiro(r.transferidas) : "—"}
                </td>
                <td className={CLASSE_NUMERO}>{formatarMoeda(r.frete, { centavos: false })}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.entregues)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.naoEntregues)}</td>
                <td className={`${CLASSE_NUMERO} font-semibold`}>
                  {r.performance !== null
                    ? formatarPercentual(r.performance, { escala: "cem" })
                    : "—"}
                </td>
                <td className={CLASSE_NUMERO}>
                  {r.fretePerdido > 0 ? formatarMoeda(r.fretePerdido, { centavos: false }) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </TabelaPropria>
    </Painel>
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
    <>
      <p className="text-[13px] text-muted-foreground">
        Base desta aba: {formatarInteiro(total)} CTRC no total — {formatarInteiro(entregues)}{" "}
        entregues. Cargas ainda em rota contam contra a produtividade até terem desfecho.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Indicador
          rotulo="Produtividade"
          icone={CircleCheck}
          neutro={!(pct !== null && pct >= 95)}
          status="bom"
          valor={pct !== null ? formatarPercentual(pct, { escala: "cem" }) : "—"}
          detalhe={
            pct !== null
              ? `${formatarInteiro(entregues)} de ${formatarInteiro(total)} CTRC entregues`
              : ""
          }
          progresso={pct !== null ? pct / 100 : undefined}
          dica="Entregues ÷ CTRC total da aba (entregues + não entregues/em rota + finalizado em sistema). Cargas em rota contam contra até terem desfecho."
        />
        <Indicador
          rotulo="Taxa de retorno"
          icone={Undo2}
          neutro={retornos === 0}
          status="ruim"
          valor={pctRetorno !== null ? formatarPercentual(pctRetorno, { escala: "cem" }) : "—"}
          detalhe={
            pctRetorno !== null
              ? `${formatarInteiro(retornos)} CTRC sem entrega · de ${formatarInteiro(total)} da aba`
              : ""
          }
          dica={TIP_RETORNO}
        />
      </div>
    </>
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
  const Olho = visivel ? EyeOff : Eye;
  return (
    <span className="inline-flex items-center gap-1">
      Placas
      {pode ? (
        <button
          type="button"
          onClick={aoAlternar}
          aria-label={visivel ? "Ocultar placas" : "Mostrar placas"}
          title={visivel ? "Ocultar placas" : "Mostrar placas"}
          className="rounded-md p-1 hover:bg-card hover:text-foreground"
        >
          <Olho className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <span title="Placa disponível só para quem tem a permissão “Romaneio · Ver placa”.">
          <Lock className="h-3.5 w-3.5" aria-hidden />
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
    <>
      <AtribuicaoLegenda codigos={filtros.codigos} />
      <Produtividade linhas={linhas} />
      <Painel
        icone={UserRound}
        titulo={`Performance por ${tipo}`}
        acoes={
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
        }
        rodape={
          !ehMotorista && (
            <span>
              O CTRC conta inteiro para cada ajudante listado nele, então o total desta aba não
              fecha com o universo de CTRCs do período.
            </span>
          )
        }
      >
        <TabelaPropria>
          <Cabecalho>
            <Th>
              {ehMotorista ? (
                titulo
              ) : (
                <TituloComDica dica="CTRC com mais de um ajudante conta integralmente para cada um; o total desta aba é maior que o número de CTRCs.">
                  Ajudante
                </TituloComDica>
              )}
            </Th>
            <Th>
              <CabecalhoPlaca
                pode={podeVerPlaca}
                visivel={mostrarPlaca}
                aoAlternar={() => {
                  setPlacaVisivel((v) => !v);
                }}
              />
            </Th>
            {ehMotorista && <Th>Equipe</Th>}
            <Th direita>
              <TituloComDica dica={TIP_VIAGENS}>Qtd. viagens</TituloComDica>
            </Th>
            <Th direita>CTRC — levados</Th>
            <Th direita>CTRC — entregues</Th>
            <Th direita>
              <TituloComDica dica={TIP_PREJUDICADAS}>CTRC — prejudicadas</TituloComDica>
              <PrejuizoSubtitulo codigos={filtros.codigos} />
            </Th>
            <Th direita>
              <TituloComDica dica={TIP_PERFORMANCE}>% Performance</TituloComDica>
            </Th>
          </Cabecalho>
          <tbody>
            <EstadoDaTabela
              colunas={colunas}
              carregando={q.isLoading}
              erro={q.error}
              aoTentarDeNovo={() => void q.refetch()}
              vazio={linhas.length === 0}
              mensagem={`Nenhum ${tipo} com saída para entrega no período.`}
            />
            {linhas.map((r) => (
              <tr
                key={r.nome}
                {...propsDaLinha(
                  ehMotorista
                    ? () => {
                        aoAbrir({ motorista: r.nome });
                      }
                    : undefined,
                )}
              >
                <td className={CLASSE_TD}>{r.nome}</td>
                <td className={`${CLASSE_CODIGO} text-muted-foreground`}>
                  {mostrarPlaca ? (
                    (r.placas ?? "—")
                  ) : (
                    <span aria-label="Placa oculta">•••••••</span>
                  )}
                </td>
                {ehMotorista && <td className={CLASSE_TD}>{r.equipe ?? "—"}</td>}
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.viagens)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.romaneados)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.entregues)}</td>
                <td className={CLASSE_NUMERO}>{formatarInteiro(r.prejudicadas)}</td>
                <td
                  className={`${CLASSE_NUMERO} font-semibold`}
                  title={`${formatarInteiro(r.romaneados)} levados − ${formatarInteiro(r.prejudicadas13)} prejudicados (cód. 13)`}
                >
                  {r.romaneados > 0
                    ? formatarPercentual(r.performance, { escala: "cem", casas: 2 })
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </TabelaPropria>
      </Painel>
      <MotivosNaoEntrega filtros={filtros} aoAbrir={aoAbrir} />
    </>
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
    <Painel
      icone={TriangleAlert}
      titulo={
        <TituloDoBloco dica="Principais motivos que impediram a entrega no período — pendências do cliente ou da operação. Uma mesma carga pode aparecer em mais de um motivo. Clique num motivo para ver as cargas.">
          Motivos de não entrega
        </TituloDoBloco>
      }
      descricao="somente ocorrências classificadas como pendência (cliente ou transportadora)"
      classeDoCorpo="px-3 py-3"
    >
      {q.isLoading && <BarrasCarregando />}
      {q.isError && <MensagemErro erro={q.error} aoTentarDeNovo={() => void q.refetch()} />}
      {q.isSuccess && linhas.length === 0 && (
        <EstadoVazio mensagem="Nenhuma ocorrência de insucesso no período." />
      )}
      <ul className="space-y-0.5">
        {linhas.map((r) => {
          // 13 (entrega prejudicada) é o motivo acompanhado de perto pela operação.
          const codigo = Number(r.codigo);
          const destaque = codigo === 13;
          return (
            <li key={r.codigo}>
              <ComDica texto={`${r.codigo} · ${r.descricao || "—"}: ${formatarInteiro(r.qtd)}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (Number.isInteger(codigo)) aoAbrir({ codigos: [codigo] });
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted/60",
                    destaque && "bg-status-bad-bg font-semibold text-status-bad-fg",
                  )}
                >
                  <span className="inline-flex w-[52px] shrink-0 items-center gap-1 font-mono text-[12px]">
                    {destaque && <TriangleAlert className="h-3.5 w-3.5" aria-hidden />}
                    <span className={cn(!destaque && "text-muted-foreground")}>{r.codigo}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.descricao || "—"}</span>
                  <Trilho
                    fracao={r.qtd / maior}
                    cor={destaque ? "var(--status-bad)" : "var(--brand)"}
                    className="w-[72px] shrink-0 sm:w-[140px]"
                  />
                  <span className="w-[52px] shrink-0 text-right tabular-nums">
                    {formatarInteiro(r.qtd)}
                  </span>
                </button>
              </ComDica>
            </li>
          );
        })}
      </ul>
    </Painel>
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
  icone,
  linhas,
  carregando,
  arquivo,
  aoAbrir,
}: {
  titulo: string;
  dica: string;
  icone: LucideIcon;
  linhas: readonly LinhaDoRanking[];
  carregando: boolean;
  arquivo: string;
  aoAbrir: (a: Abertura) => void;
}) {
  const maior = Math.max(1, ...linhas.map((l) => l.frete));
  return (
    <Painel
      icone={icone}
      titulo={<TituloDoBloco dica={dica}>{titulo}</TituloDoBloco>}
      acoes={
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
      }
      classeDoCorpo="px-3 py-3"
    >
      {carregando && <BarrasCarregando />}
      {!carregando && linhas.length === 0 && <EstadoVazio mensagem="Nada a mostrar no período." />}
      <ul className="space-y-0.5">
        {linhas.map((l, i) => (
          <li key={`${l.nome}-${i}`}>
            <ComDica
              texto={`${l.nome}${l.placa ? ` (${l.placa})` : ""}: ${formatarMoeda(l.frete, { centavos: false })} · ${formatarInteiro(l.ctes)} CTRC`}
            >
              <button
                type="button"
                onClick={() => {
                  aoAbrir(l.abertura);
                }}
                className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-muted/60"
              >
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {l.nome}
                    {l.placa && (
                      <span className="ml-1.5 font-mono text-[12px] text-muted-foreground">
                        {l.placa}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-semibold text-status-bad-fg tabular-nums">
                    {formatarMoeda(l.frete, { centavos: false })}
                  </span>
                  <span className="w-[44px] shrink-0 text-right text-muted-foreground tabular-nums">
                    {formatarInteiro(l.ctes)}
                  </span>
                </span>
                <Trilho fracao={l.frete / maior} cor="var(--status-bad)" className="mt-1.5 h-1.5" />
              </button>
            </ComDica>
          </li>
        ))}
      </ul>
    </Painel>
  );
}

/** Aba Prejuízo: frete das cargas prejudicadas por dia e rankings (janela = período, Q14). */
export function AbaPrejuizo({ filtros, aoAbrir }: PropsDaAba) {
  const q = useQuery(consultaPrejuizo(filtros));
  const d = q.data;
  const porDia = d?.porDia ?? [];
  const prejuizo: Abertura = { recorte: "prejuizo" };
  const ranking = (
    linhas: readonly { nome: string; placa: string | null; ctes: number; frete: number }[],
    abertura: (nome: string) => Abertura,
  ) => linhas.map((l) => ({ ...l, abertura: abertura(l.nome) }));
  return (
    <>
      <AtribuicaoLegenda codigos={filtros.codigos} />
      <Aviso tom="info">
        Prejuízo aqui são as cargas com {textoDoPrejuizo(filtros.codigos)}. Sem filtro de código, o
        padrão é o código 13 (Entrega Prejudicada). Os totais estão no card Prejuízo do topo;
        abaixo, o frete dessas cargas por dia e onde ele se concentra.
      </Aviso>
      <Painel
        icone={TrendingDown}
        titulo={
          <TituloDoBloco dica="Valor de frete comprometido em cada dia do período. Passe o mouse para ver a quantidade de cargas.">
            Prejuízo por dia
          </TituloDoBloco>
        }
        acoes={
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
        }
      >
        {q.isError ? (
          <MensagemErro
            erro={q.error}
            titulo="Não foi possível carregar os dados do gráfico"
            aoTentarDeNovo={() => void q.refetch()}
          />
        ) : (
          <GraficoBarras
            dados={porDia.map((x) => ({ ...x, rotulo: formatarDiaMes(x.dia) }))}
            eixoX="rotulo"
            series={[{ chave: "frete", nome: "Frete", cor: "var(--status-bad)" }]}
            formato="inteiro"
            altura={240}
            carregando={q.isLoading}
            mensagemVazia="Nenhum prejuízo registrado no período."
            descricao="Prejuízo por dia: frete das cargas prejudicadas em cada dia do período"
            dica={(x) => (
              <DicaDoPrejuizo titulo={formatarData(x.dia)} frete={x.frete} ctes={x.ctes} />
            )}
          />
        )}
      </Painel>
      <div className="grid gap-4 lg:grid-cols-3">
        <RankingDoPrejuizo
          titulo="Cidades"
          icone={MapPin}
          dica="Cidades de destino onde o prejuízo se concentra no período."
          carregando={q.isLoading}
          linhas={ranking(d?.cidades ?? [], () => prejuizo)}
          arquivo="romaneio-prejuizo-cidade"
          aoAbrir={aoAbrir}
        />
        <RankingDoPrejuizo
          titulo="Pagadores"
          icone={Banknote}
          dica="Clientes pagadores das cargas com prejuízo no período."
          carregando={q.isLoading}
          linhas={ranking(d?.pagadores ?? [], () => prejuizo)}
          arquivo="romaneio-prejuizo-pagador"
          aoAbrir={aoAbrir}
        />
        <RankingDoPrejuizo
          titulo="Motoristas"
          icone={UserRound}
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
    </>
  );
}
