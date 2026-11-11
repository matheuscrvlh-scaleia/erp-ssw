import {
  agruparPorPessoa,
  type LinhaBonificacao,
  type ResumoPessoa,
} from "@erp/dominio/bonificacao-entrega";
import { type EntradaDe } from "@erp/shared/contrato";
import {
  type contratosBonificacaoEntrega as c,
  NIVEIS_DE_BONIFICACAO,
} from "@erp/shared/contratos/bonificacao-entrega";
import { hojeNoFuso } from "@erp/shared/datas";
import { formatarDiaMes, formatarMoeda } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarX,
  ChevronDown,
  ChevronRight,
  PackageCheck,
  Play,
  RefreshCw,
  UsersRound,
  Wallet,
} from "lucide-react";
import { type KeyboardEvent, useMemo, useState } from "react";

import { Alternador } from "@/componentes/comum/Alternador";
import { Aviso } from "@/componentes/comum/Aviso";
import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
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
import { consultaApuracao, consultaUnidades } from "./api";
import { ComoFuncionaBonificacao } from "./ComoFuncionaBonificacao";
import { NIVEL } from "./niveis";
import { QuadroDeFaltas } from "./QuadroDeFaltas";

const TODAS = "__todas__";

const ROTULO_DA_HORA_EXTRA: Record<string, string> = {
  [TODAS]: "Todas",
  sim: "Fez hora extra",
  nao: "Não fez",
  sem_ponto: "Sem registro de ponto",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Verde = sem hora extra (vale Turbo). Vermelho = fez. Cinza = sem ponto. */
function BolinhaHoraExtra({ valor }: { valor: boolean | null }) {
  const cor =
    valor === null ? "bg-muted-foreground/40" : valor ? "bg-status-bad" : "bg-status-good";
  const titulo =
    valor === null ? "Sem registro de ponto" : valor ? "Fez hora extra" : "Sem hora extra";
  return (
    <span
      role="img"
      className={`inline-block h-2.5 w-2.5 rounded-full ${cor}`}
      title={titulo}
      aria-label={titulo}
    />
  );
}

const TH_DO_DIA = "py-1.5 pr-3 label-xs";

function LinhaPessoa({ p }: { p: ResumoPessoa }) {
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
        aria-expanded={aberto}
        className={cn(
          CLASSE_LINHA,
          "cursor-pointer focus-visible:bg-accent focus-visible:outline-none",
          aberto && "bg-muted/40",
        )}
        onClick={alternar}
        onKeyDown={tecla}
      >
        <td className={CLASSE_TD}>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            {aberto ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            )}
            <span className="font-semibold">{p.colaborador}</span>
            <SeloStatus tom="neutro" semIcone>
              {p.funcao}
            </SeloStatus>
            {p.zerados > 0 && (
              <SeloStatus tom="erro">
                {p.zerados} zerado{p.zerados > 1 ? "s" : ""} por falta
              </SeloStatus>
            )}
          </div>
        </td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.dias}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.entregues}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.retornos}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{pct(p.exitoMedio)}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.diasTurbo}</td>
        <td className={cn(CLASSE_TD, "text-right")}>{p.diasSemBonus}</td>
        <td className={CLASSE_TD}>
          {/* No resumo a pessoa tem vários dias: a bolinha mostra se houve hora extra em algum
              deles, e o número diz em quantos. */}
          <div className="flex items-center justify-end gap-1.5">
            <BolinhaHoraExtra valor={p.diasHoraExtra > 0} />
            <span className="text-muted-foreground">
              {p.diasHoraExtra}/{p.dias}
            </span>
          </div>
        </td>
        <td className={cn(CLASSE_TD, "text-right")}>
          {p.semPonto > 0 ? (
            <span className="font-semibold text-status-warn-fg">{p.semPonto}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className={cn(CLASSE_TD, "text-right font-semibold")}>{formatarMoeda(p.total)}</td>
      </tr>
      {aberto && (
        <tr className="border-b border-border">
          <td colSpan={10} className="bg-superficie px-4 py-2">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px] tabular-nums">
                <thead>
                  <tr className="text-left">
                    <th className={TH_DO_DIA}>Dia</th>
                    <th className={TH_DO_DIA}>Romaneio</th>
                    <th className={TH_DO_DIA}>Função</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>NFs</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>SAC</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>Retornos</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>Pend.</th>
                    <th className={cn(TH_DO_DIA, "text-right")}>Êxito</th>
                    <th className={cn(TH_DO_DIA, "text-center")}>HE</th>
                    <th className={TH_DO_DIA}>Nível</th>
                    <th className={cn(TH_DO_DIA, "pr-0 text-right")}>Bônus</th>
                  </tr>
                </thead>
                <tbody>
                  {p.linhas.map((l) => (
                    <tr
                      key={`${l.dataRomaneio}-${l.romaneio}-${l.funcao}`}
                      className="border-t border-border"
                    >
                      <td className="py-1.5 pr-3">{formatarDiaMes(l.dataRomaneio)}</td>
                      <td className="py-1.5 pr-3 font-mono text-muted-foreground">{l.romaneio}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{l.funcao}</td>
                      <td className="py-1.5 pr-3 text-right">{l.nfsCarregadas}</td>
                      <td className="py-1.5 pr-3 text-right">{l.sac}</td>
                      <td className="py-1.5 pr-3 text-right">{l.retornos}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {l.pendentes > 0 ? (
                          <span className="font-semibold text-status-warn-fg">{l.pendentes}</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{pct(l.exito)}</td>
                      <td className="py-1.5 pr-3 text-center">
                        <BolinhaHoraExtra valor={l.horaExtra} />
                      </td>
                      <td className="py-1.5 pr-3">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <SeloStatus tom={NIVEL[l.nivel].tom} icone={NIVEL[l.nivel].icone}>
                            {NIVEL[l.nivel].rotulo}
                          </SeloStatus>
                          {l.semRegistroPonto && (
                            <span
                              className="text-xs font-semibold text-status-warn-fg"
                              title="Sem registro de ponto no Ahgora"
                            >
                              sem ponto
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-1.5 text-right">
                        {l.zeradoPorFalta ? (
                          <span className="text-status-bad-fg line-through">
                            {formatarMoeda(l.bonus)}
                          </span>
                        ) : (
                          formatarMoeda(l.bonus)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

type Filtros = EntradaDe<typeof c.apurar>;
type Visao = "pessoa" | "dia";

/** origem: features/bonificacao/components/BonificacaoScreen.tsx (sistema atual) */
export function PaginaBonificacaoEntrega() {
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [unidade, setUnidade] = useState<string>(TODAS);
  const [funcao, setFuncao] = useState<string>(TODAS);
  const [horaExtra, setHoraExtra] = useState<string>(TODAS);
  const [usarPonto, setUsarPonto] = useState(true);
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [visao, setVisao] = useState<Visao>("pessoa");

  const unidades = useQuery(consultaUnidades);
  const q = useQuery(consultaApuracao(filtros));

  const todasLinhas = useMemo(() => q.data ?? [], [q.data]);

  // Os filtros valem sobre as linhas pessoa-dia, então os totais e o resumo por colaborador
  // passam a refletir só o recorte escolhido.
  const linhas = useMemo(
    () =>
      todasLinhas.filter((l) => {
        if (funcao !== TODAS && l.funcao !== funcao) return false;
        if (horaExtra === "sim" && l.horaExtra !== true) return false;
        if (horaExtra === "nao" && l.horaExtra !== false) return false;
        if (horaExtra === "sem_ponto" && l.horaExtra !== null) return false;
        return true;
      }),
    [todasLinhas, funcao, horaExtra],
  );

  const pessoas = useMemo(() => agruparPorPessoa(linhas), [linhas]);
  const filtrando = funcao !== TODAS || horaExtra !== TODAS;

  const porDia = useMemo(() => {
    const mapa = new Map<string, LinhaBonificacao[]>();
    for (const l of linhas) {
      const dia = l.dataRomaneio.slice(0, 10);
      const atual = mapa.get(dia);
      if (atual) atual.push(l);
      else mapa.set(dia, [l]);
    }
    return [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  }, [linhas]);

  const total = pessoas.reduce((a, p) => a + Math.round(p.total * 10_000), 0) / 10_000;
  const semPonto = linhas.filter((l) => l.semRegistroPonto).length;
  const pendentes = linhas.filter((l) => l.pendentes > 0).length;

  function apurar() {
    const { inicio, fim } = periodoDoMes(mes);
    setFiltros({
      inicio,
      fim,
      unidades: unidade === TODAS ? undefined : [unidade],
      usarPonto,
    });
  }

  const etiquetas: EtiquetaFiltroOpcional[] = [
    funcao !== TODAS && {
      rotulo: "Função",
      valor: funcao,
      limpar: () => {
        setFuncao(TODAS);
      },
    },
    horaExtra !== TODAS && {
      rotulo: "Hora extra",
      valor: ROTULO_DA_HORA_EXTRA[horaExtra] ?? horaExtra,
      limpar: () => {
        setHoraExtra(TODAS);
      },
    },
  ];

  return (
    <Pagina
      titulo="Bonificação de entrega"
      descricao="Apuração do bônus por colaborador, a partir dos romaneios e das ocorrências do dia. A hora extra vem do ponto no Ahgora e é o que separa Turbo de Acelerado."
      acoes={<ComoFuncionaBonificacao />}
      filtros={
        <>
          <FiltrosAvancados
            ativos={filtrando}
            aoLimpar={() => {
              setFuncao(TODAS);
              setHoraExtra(TODAS);
            }}
          >
            <CampoRotulado rotulo="Mês" htmlFor="bonificacao-mes">
              <input
                id="bonificacao-mes"
                type="month"
                className={CLASSE_DO_CAMPO}
                value={mes}
                onChange={(e) => {
                  setMes(e.target.value);
                }}
              />
            </CampoRotulado>
            <Select value={unidade} onValueChange={setUnidade}>
              <GatilhoRotulado rotulo="Unidade" />
              <SelectContent>
                {(unidades.data ?? []).map((u) => (
                  <SelectItem key={u.unidade} value={u.unidade}>
                    {u.unidade}
                  </SelectItem>
                ))}
                <SelectItem value={TODAS}>Todas</SelectItem>
              </SelectContent>
            </Select>
            <InterruptorRotulado id="usar-ponto" rotulo="Usar ponto do Ahgora para hora extra">
              <Switch id="usar-ponto" checked={usarPonto} onCheckedChange={setUsarPonto} />
            </InterruptorRotulado>
            <Button onClick={apurar} disabled={q.isFetching}>
              <Play aria-hidden />
              {q.isFetching ? "Apurando…" : "Apurar"}
            </Button>
            {q.data && (
              <>
                <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
                <Select value={funcao} onValueChange={setFuncao}>
                  <GatilhoRotulado rotulo="Função" />
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas</SelectItem>
                    <SelectItem value="Motorista">Motorista</SelectItem>
                    <SelectItem value="Ajudante">Ajudante</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={horaExtra} onValueChange={setHoraExtra}>
                  <GatilhoRotulado rotulo="Hora extra" />
                  <SelectContent>
                    {Object.entries(ROTULO_DA_HORA_EXTRA).map(([valor, rotulo]) => (
                      <SelectItem key={valor} value={valor}>
                        {rotulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </FiltrosAvancados>
          <FiltrandoPor etiquetas={etiquetas} />
          <p className="text-xs text-muted-foreground">
            Com o ponto ligado, a apuração consulta o Ahgora colaborador por colaborador e leva
            alguns segundos a mais. Sem ele, ninguém chega a Turbo.
          </p>
        </>
      }
    >
      {q.error && (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              <RefreshCw aria-hidden /> Tentar novamente
            </Button>
          }
        >
          {mensagemAmigavel(q.error)}
        </Aviso>
      )}

      {q.isFetching ? (
        <div className="space-y-4" aria-busy>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl bg-muted" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-2xl bg-muted" />
        </div>
      ) : q.data ? (
        <>
          {filtrando && (
            <Aviso tom="info">
              Filtro ativo: os totais abaixo somam só {linhas.length} de {todasLinhas.length}{" "}
              lançamentos.
            </Aviso>
          )}
          {pendentes > 0 && (
            <Aviso tom="alerta">
              {pendentes} de {linhas.length} linhas têm NF sem desfecho registrado no dia. Elas
              contam como entregues, então o valor apurado pode cair quando as ocorrências fecharem.
            </Aviso>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              rotulo="Colaboradores"
              valor={String(pessoas.length)}
              status="bom"
              neutro
              icone={UsersRound}
              detalhe={`${String(linhas.length)} lançamentos pessoa-dia`}
            />
            <KpiCard
              rotulo="NFs entregues"
              valor={String(linhas.reduce((a, l) => a + l.nfsEntregues, 0))}
              status="bom"
              neutro
              icone={PackageCheck}
              detalhe="carregadas − SAC − retornos"
            />
            <KpiCard
              rotulo="Custo total"
              valor={formatarMoeda(total)}
              status="bom"
              neutro
              icone={Wallet}
              detalhe="soma do bônus no recorte"
            />
            <KpiCard
              rotulo="Dias sem ponto"
              valor={String(semPonto)}
              status={semPonto > 0 ? "alerta" : "bom"}
              icone={CalendarX}
              detalhe={semPonto > 0 ? "nível limitado a Acelerado" : "todos com ponto"}
            />
          </div>

          <Painel
            barra={
              <Alternador
                rotulo="Visão da apuração"
                valor={visao}
                aoMudar={setVisao}
                opcoes={[
                  { valor: "pessoa", rotulo: "Por colaborador" },
                  { valor: "dia", rotulo: "Por dia" },
                ]}
              />
            }
          >
            <div className="rolagem-fina relative overflow-x-auto rounded-xl">
              {visao === "pessoa" ? (
                <table className={CLASSE_TABELA}>
                  <thead>
                    <tr className={CLASSE_CABECALHO}>
                      <th scope="col" className={CLASSE_TH}>
                        Colaborador
                      </th>
                      {[
                        "Dias",
                        "NFs entregues",
                        "Retornos",
                        "Êxito médio",
                        "Dias Turbo",
                        "Sem bônus",
                        "Hora extra",
                        "Sem ponto",
                        "Bônus",
                      ].map((t) => (
                        <th key={t} scope="col" className={cn(CLASSE_TH, "text-right")}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pessoas.map((p) => (
                      <LinhaPessoa key={p.colaborador} p={p} />
                    ))}
                    {pessoas.length === 0 && (
                      <tr>
                        <td colSpan={10}>
                          <EstadoVazio
                            mensagem="Nenhum lançamento no recorte."
                            detalhe="Troque o mês, a unidade ou tire os filtros de função e hora extra."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/70 font-semibold">
                      <td className={CLASSE_TD}>Total do período</td>
                      <td colSpan={8} />
                      <td className={cn(CLASSE_TD, "text-right")}>{formatarMoeda(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table className={CLASSE_TABELA}>
                  <thead>
                    <tr className={CLASSE_CABECALHO}>
                      <th scope="col" className={CLASSE_TH}>
                        Dia
                      </th>
                      {[
                        "Veículos",
                        "Pessoas",
                        "NFs entregues",
                        "Turbo",
                        "Acelerado",
                        "Em rota",
                        "Sem bônus",
                        "Custo do dia",
                      ].map((t) => (
                        <th key={t} scope="col" className={cn(CLASSE_TH, "text-right")}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {porDia.map(([dia, ls]) => (
                      <tr key={dia} className={CLASSE_LINHA}>
                        <td className={cn(CLASSE_TD, "font-semibold")}>{formatarDiaMes(dia)}</td>
                        <td className={cn(CLASSE_TD, "text-right")}>
                          {new Set(ls.map((l) => l.romaneio)).size}
                        </td>
                        <td className={cn(CLASSE_TD, "text-right")}>{ls.length}</td>
                        <td className={cn(CLASSE_TD, "text-right")}>
                          {ls.reduce((a, l) => a + l.nfsEntregues, 0)}
                        </td>
                        {NIVEIS_DE_BONIFICACAO.map((n) => (
                          <td key={n} className={cn(CLASSE_TD, "text-right")}>
                            {ls.filter((l) => l.nivel === n).length}
                          </td>
                        ))}
                        <td className={cn(CLASSE_TD, "text-right font-semibold")}>
                          {formatarMoeda(
                            ls.reduce((a, l) => a + Math.round(l.bonus * 10_000), 0) / 10_000,
                          )}
                        </td>
                      </tr>
                    ))}
                    {porDia.length === 0 && (
                      <tr>
                        <td colSpan={9}>
                          <EstadoVazio mensagem="Nenhum lançamento no recorte." />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </Painel>
        </>
      ) : (
        !q.error && (
          <Painel>
            <EstadoVazio icone={Play} mensagem="Escolha o mês e a unidade e clique em “Apurar”." />
          </Painel>
        )
      )}

      {/* key: trocar o mês recomeça o formulário no dia 1 do mês novo. */}
      <QuadroDeFaltas key={mes} mes={mes} />
    </Pagina>
  );
}
