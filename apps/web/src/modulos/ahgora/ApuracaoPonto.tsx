import { type EntradaDe } from "@erp/shared/contrato";
import {
  type contratosAhgora as c,
  type FuncionarioApurado,
  type MOTIVOS_DE_REVISAO,
} from "@erp/shared/contratos/ahgora";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarDiaMes } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Clock,
  Play,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { type KeyboardEvent, type ReactNode, useState } from "react";

import { Aviso } from "@/componentes/comum/Aviso";
import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { KpiCard } from "@/componentes/comum/KpiCard";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Pagina } from "@/componentes/layout/Pagina";
import { Button } from "@/componentes/ui/button";
import { Select, SelectContent, SelectItem } from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { cn } from "@/lib/utils";

import {
  CampoRotulado,
  CLASSE_DO_CAMPO,
  GatilhoRotulado,
  InterruptorRotulado,
} from "../ranking/campos-do-filtro";
import { mesDe, periodoDoMes } from "../ranking/periodo";
import { consultaApuracaoDoPonto, consultaDepartamentos } from "./api";
import { ComoFuncionaPonto } from "./ComoFuncionaPonto";

const TODOS = "__todos__";

const MOTIVO_LABEL: Record<(typeof MOTIVOS_DE_REVISAO)[number], string> = {
  impar: "Número ímpar de batidas — falta uma marcação ou o turno virou a meia-noite",
  excluida: "Há batida excluída no dia — confira a marcação que a substituiu",
};

function formatarHoras(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${h}h${m > 0 ? ` ${String(m).padStart(2, "0")}m` : ""}`;
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

const TH_DO_DIA = "py-1.5 pr-3 label-xs";

function LinhaFuncionario({ f }: { f: FuncionarioApurado }) {
  const [aberto, setAberto] = useState(false);
  const alternar = () => {
    setAberto((v) => !v);
  };
  const tecla = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    alternar();
  };
  return (
    <>
      <tr
        tabIndex={0}
        className={cn(
          CLASSE_LINHA,
          "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
          aberto && "bg-muted/40",
        )}
        onClick={alternar}
        onKeyDown={tecla}
        aria-expanded={aberto}
      >
        <td className={CLASSE_TD}>
          <div className="flex items-center gap-1.5">
            {aberto ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            <span className="font-semibold">{f.name}</span>
            {f.demitido && <SeloStatus tom="erro">demitido</SeloStatus>}
          </div>
        </td>
        <td className={cn(CLASSE_TD, "font-mono text-xs text-muted-foreground")}>{f.register}</td>
        <td className={cn(CLASSE_TD, "text-muted-foreground")}>{f.department || "—"}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{f.diasComRegistro}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{formatarHoras(f.minutosApurados)}</td>
        <td className={cn(CLASSE_TD, "text-right")}>
          {f.diasARevisar > 0 ? (
            <SeloStatus tom="alerta">{f.diasARevisar}</SeloStatus>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>

      {aberto && (
        <tr className="border-b border-border">
          <td colSpan={6} className="bg-superficie px-4 py-2">
            {f.dias.length === 0 ? (
              <p className="py-1 text-xs text-muted-foreground">
                Nenhuma batida registrada no período.
              </p>
            ) : (
              <table className="w-full text-[12.5px] tabular-nums">
                <thead>
                  <tr className="text-left">
                    <th className={TH_DO_DIA}>Dia</th>
                    <th className={TH_DO_DIA}>Batidas</th>
                    <th className={cn(TH_DO_DIA, "pr-0 text-right")}>Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {f.dias.map((d) => (
                    <tr key={d.data} className="border-t border-border">
                      <td className="py-1.5 pr-3 align-top">{formatarDiaMes(d.data)}</td>
                      <td className="py-1.5 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {d.batidas.map((b, i) => (
                            <span
                              key={`${b.hora}-${i}`}
                              className={cn(
                                "rounded-md border px-1.5 font-mono",
                                b.tipo === "DELETADA"
                                  ? "border-status-bad/30 text-status-bad-fg line-through"
                                  : "border-border bg-card",
                              )}
                              title={b.tipo}
                            >
                              {b.hora}
                            </span>
                          ))}
                        </div>
                        {d.motivoRevisao && (
                          <p className="mt-1 flex items-start gap-1 text-xs text-status-warn-fg">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                            {MOTIVO_LABEL[d.motivoRevisao]}
                          </p>
                        )}
                      </td>
                      <td className="py-1.5 text-right align-top">
                        {d.minutosTrabalhados === null ? (
                          <span className="font-semibold text-status-warn-fg">revisar</span>
                        ) : (
                          formatarHoras(d.minutosTrabalhados)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/** origem: features/ahgora/components/ApuracaoPontoScreen.tsx (sistema atual) */
export function ApuracaoPonto({ abas }: { abas: ReactNode }) {
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [departamento, setDepartamento] = useState<string>(TODOS);
  const [incluirDemitidos, setIncluirDemitidos] = useState(false);
  const [filtros, setFiltros] = useState<EntradaDe<typeof c.apuracao> | null>(null);

  const departamentos = useQuery(consultaDepartamentos);
  const apuracao = useQuery(consultaApuracaoDoPonto(filtros));

  function apurar() {
    const { inicio, fim } = periodoDoMes(mes);
    setFiltros({
      inicio,
      fim,
      departamento: departamento === TODOS ? undefined : departamento,
      incluirDemitidos: incluirDemitidos ? "true" : "false",
    });
  }

  const funcionarios = apuracao.data?.funcionarios ?? [];
  const totalMinutos = funcionarios.reduce((acc, f) => acc + f.minutosApurados, 0);
  const totalRevisar = funcionarios.reduce((acc, f) => acc + f.diasARevisar, 0);

  return (
    <Pagina
      titulo="Apuração de ponto (Ahgora)"
      descricao="Marcações de ponto por colaborador e período, consolidadas direto do Ahgora. Dias que não fecham com segurança aparecem como “revisar” em vez de receberem um total estimado."
      acoes={<ComoFuncionaPonto />}
      abas={abas}
      filtros={
        <>
          <FiltrosAvancados>
            <CampoRotulado rotulo="Mês" htmlFor="ponto-mes">
              <input
                id="ponto-mes"
                type="month"
                className={CLASSE_DO_CAMPO}
                value={mes}
                onChange={(e) => {
                  setMes(e.target.value);
                }}
              />
            </CampoRotulado>
            <Select value={departamento} onValueChange={setDepartamento}>
              <GatilhoRotulado rotulo="Departamento" placeholder="Todos" className="max-w-80" />
              <SelectContent>
                <SelectItem value={TODOS}>Todos os departamentos</SelectItem>
                {(departamentos.data ?? []).map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InterruptorRotulado id="incluir-demitidos" rotulo="Incluir demitidos">
              <Switch
                id="incluir-demitidos"
                checked={incluirDemitidos}
                onCheckedChange={setIncluirDemitidos}
              />
            </InterruptorRotulado>
            <Button onClick={apurar} disabled={apuracao.isFetching}>
              <Play aria-hidden />
              {apuracao.isFetching ? "Apurando…" : "Apurar"}
            </Button>
          </FiltrosAvancados>
          <p className="text-xs text-muted-foreground">
            A consulta busca as batidas de um colaborador por vez no Ahgora, então apurar um
            departamento leva alguns segundos. Períodos maiores que um mês não são aceitos pela API.
          </p>
        </>
      }
    >
      {apuracao.error && (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" onClick={() => void apuracao.refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(apuracao.error)}
        </Aviso>
      )}

      {apuracao.isFetching ? (
        <div className="space-y-4" aria-busy>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl bg-muted" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl bg-muted" />
        </div>
      ) : apuracao.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              rotulo="Colaboradores"
              valor={String(funcionarios.length)}
              status="bom"
              neutro
              icone={UsersRound}
              detalhe="na apuração"
            />
            <KpiCard
              rotulo="Dias com registro"
              valor={String(funcionarios.reduce((a, f) => a + f.diasComRegistro, 0))}
              status="bom"
              neutro
              icone={CalendarCheck}
              detalhe="somados de todos"
            />
            <KpiCard
              rotulo="Horas apuradas"
              valor={formatarHoras(totalMinutos)}
              status="bom"
              neutro
              icone={Clock}
              detalhe="só dias que fecharam"
            />
            <KpiCard
              rotulo="Dias a revisar"
              valor={String(totalRevisar)}
              status={totalRevisar > 0 ? "alerta" : "bom"}
              icone={CalendarClock}
              detalhe={totalRevisar > 0 ? "fora das horas apuradas" : "nenhum dia pendente"}
            />
          </div>

          <Painel
            titulo={`Colaboradores · ${dataBr(apuracao.data.inicio)} a ${dataBr(apuracao.data.fim)}`}
          >
            {funcionarios.length === 0 ? (
              <EstadoVazio
                mensagem="Nenhum colaborador encontrado para os filtros selecionados."
                detalhe="Escolha outro departamento ou ligue “Incluir demitidos”."
              />
            ) : (
              <div className="rolagem-fina relative overflow-x-auto rounded-b-xl">
                <table className={CLASSE_TABELA}>
                  <thead>
                    <tr className={CLASSE_CABECALHO}>
                      <th scope="col" className={CLASSE_TH}>
                        Colaborador
                      </th>
                      <th scope="col" className={CLASSE_TH}>
                        Matrícula
                      </th>
                      <th scope="col" className={CLASSE_TH}>
                        Departamento
                      </th>
                      <th scope="col" className={cn(CLASSE_TH, "text-right")}>
                        Dias
                      </th>
                      <th scope="col" className={cn(CLASSE_TH, "text-right")}>
                        Horas apuradas
                      </th>
                      <th scope="col" className={cn(CLASSE_TH, "text-right")}>
                        A revisar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {funcionarios.map((f) => (
                      <LinhaFuncionario key={f.register} f={f} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </>
      ) : (
        !apuracao.error && (
          <Painel>
            <EstadoVazio
              icone={Play}
              mensagem="Escolha o mês e o departamento e clique em “Apurar”."
            />
          </Painel>
        )
      )}
    </Pagina>
  );
}
