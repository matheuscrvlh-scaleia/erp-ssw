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
import { AlertTriangle, ChevronDown, ChevronRight, Play } from "lucide-react";
import { useMemo, useState } from "react";

import { Abas, ConteudoDaAba } from "@/componentes/comum/Abas";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Input } from "@/componentes/ui/input";
import { Label } from "@/componentes/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/componentes/ui/select";
import { Skeleton } from "@/componentes/ui/skeleton";
import { Switch } from "@/componentes/ui/switch";
import { useFusoDaEmpresa } from "@/hooks/use-fuso-da-empresa";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";

import { mesDe, periodoDoMes } from "../ranking/periodo";
import { consultaApuracao, consultaUnidades } from "./api";
import { ComoFuncionaBonificacao } from "./ComoFuncionaBonificacao";
import { QuadroDeFaltas } from "./QuadroDeFaltas";

const TODAS = "__todas__";

const NIVEL_LABEL: Record<LinhaBonificacao["nivel"], string> = {
  turbo: "Turbo",
  acelerado: "Acelerado",
  em_rota: "Em rota",
  sem_bonus: "Sem bônus",
};

const NIVEL_COR: Record<LinhaBonificacao["nivel"], string> = {
  turbo: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  acelerado: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  em_rota: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  sem_bonus: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Verde = sem hora extra (vale Turbo). Vermelho = fez. Cinza = sem ponto. */
function BolinhaHoraExtra({ valor }: { valor: boolean | null }) {
  const cor = valor === null ? "bg-muted-foreground/40" : valor ? "bg-red-500" : "bg-emerald-500";
  const titulo =
    valor === null ? "Sem registro de ponto" : valor ? "Fez hora extra" : "Sem hora extra";
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${cor}`}
      title={titulo}
      aria-label={titulo}
    />
  );
}

function LinhaPessoa({ p }: { p: ResumoPessoa }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-muted/30"
        onClick={() => {
          setAberto((v) => !v);
        }}
      >
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            {aberto ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="font-medium">{p.colaborador}</span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {p.funcao}
            </Badge>
            {p.zerados > 0 && (
              <Badge variant="destructive" className="text-[10px]">
                {p.zerados} zerado{p.zerados > 1 ? "s" : ""} por falta
              </Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums">{p.dias}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{p.entregues}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{p.retornos}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{pct(p.exitoMedio)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{p.diasTurbo}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{p.diasSemBonus}</td>
        <td className="px-3 py-1.5">
          {/* No resumo a pessoa tem vários dias: a bolinha mostra se houve hora extra em algum
              deles, e o número diz em quantos. */}
          <div className="flex items-center justify-end gap-1.5">
            <BolinhaHoraExtra valor={p.diasHoraExtra > 0} />
            <span className="tabular-nums text-muted-foreground">
              {p.diasHoraExtra}/{p.dias}
            </span>
          </div>
        </td>
        <td className="px-3 py-1.5 text-right tabular-nums">
          {p.semPonto > 0 ? (
            <span className="text-amber-600">{p.semPonto}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-1.5 text-right font-medium tabular-nums">
          {formatarMoeda(p.total)}
        </td>
      </tr>
      {aberto && (
        <tr>
          <td colSpan={10} className="bg-muted/20 px-3 py-2">
            <table className="w-full text-[11px]">
              <thead className="text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="py-1 text-left font-medium">Dia</th>
                  <th className="py-1 text-left font-medium">Romaneio</th>
                  <th className="py-1 text-left font-medium">Função</th>
                  <th className="py-1 text-right font-medium">NFs</th>
                  <th className="py-1 text-right font-medium">SAC</th>
                  <th className="py-1 text-right font-medium">Retornos</th>
                  <th className="py-1 text-right font-medium">Pend.</th>
                  <th className="py-1 text-right font-medium">Êxito</th>
                  <th className="py-1 text-center font-medium">HE</th>
                  <th className="py-1 text-left font-medium">Nível</th>
                  <th className="py-1 text-right font-medium">Bônus</th>
                </tr>
              </thead>
              <tbody>
                {p.linhas.map((l) => (
                  <tr
                    key={`${l.dataRomaneio}-${l.romaneio}-${l.funcao}`}
                    className="border-t border-border/30"
                  >
                    <td className="py-1 font-mono">{formatarDiaMes(l.dataRomaneio)}</td>
                    <td className="py-1 font-mono text-muted-foreground">{l.romaneio}</td>
                    <td className="py-1 text-muted-foreground">{l.funcao}</td>
                    <td className="py-1 text-right tabular-nums">{l.nfsCarregadas}</td>
                    <td className="py-1 text-right tabular-nums">{l.sac}</td>
                    <td className="py-1 text-right tabular-nums">{l.retornos}</td>
                    <td className="py-1 text-right tabular-nums">
                      {l.pendentes > 0 ? (
                        <span className="text-amber-600">{l.pendentes}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-1 text-right tabular-nums">{pct(l.exito)}</td>
                    <td className="py-1 text-center">
                      <BolinhaHoraExtra valor={l.horaExtra} />
                    </td>
                    <td className="py-1">
                      <span className={`rounded px-1.5 py-0.5 ${NIVEL_COR[l.nivel]}`}>
                        {NIVEL_LABEL[l.nivel]}
                      </span>
                      {l.semRegistroPonto && (
                        <span
                          className="ml-1 text-amber-600"
                          title="Sem registro de ponto no Ahgora"
                        >
                          sem ponto
                        </span>
                      )}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {l.zeradoPorFalta ? (
                        <span className="text-destructive line-through">
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
          </td>
        </tr>
      )}
    </>
  );
}

type Filtros = EntradaDe<typeof c.apurar>;

/** origem: features/bonificacao/components/BonificacaoScreen.tsx (sistema atual) */
export function PaginaBonificacaoEntrega() {
  const hoje = hojeNoFuso(useFusoDaEmpresa());
  const [mes, setMes] = useState(() => mesDe(hoje));
  const [unidade, setUnidade] = useState<string>(TODAS);
  const [funcao, setFuncao] = useState<string>(TODAS);
  const [horaExtra, setHoraExtra] = useState<string>(TODAS);
  const [usarPonto, setUsarPonto] = useState(true);
  const [filtros, setFiltros] = useState<Filtros | null>(null);

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

  return (
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-medium tracking-tight">Bonificação de entrega</h1>
          <ComoFuncionaBonificacao />
        </div>
        <p className="text-[12px] text-muted-foreground">
          Apuração do bônus por colaborador, a partir dos romaneios e das ocorrências do dia. A hora
          extra vem do ponto no Ahgora e é o que separa Turbo de Acelerado.
        </p>
      </header>

      <section className="rounded-[10px] border border-border/70 bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-[auto_auto_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="bonificacao-mes" className="text-[11px]">
              Mês
            </Label>
            <Input
              id="bonificacao-mes"
              type="month"
              className="h-8 text-[12px]"
              value={mes}
              onChange={(e) => {
                setMes(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">Unidade</Label>
            <Select value={unidade} onValueChange={setUnidade}>
              <SelectTrigger className="h-8 w-[160px] text-[12px]" aria-label="Unidade">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(unidades.data ?? []).map((u) => (
                  <SelectItem key={u.unidade} value={u.unidade}>
                    {u.unidade}
                  </SelectItem>
                ))}
                <SelectItem value={TODAS}>Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 pb-1.5">
            <Switch id="usar-ponto" checked={usarPonto} onCheckedChange={setUsarPonto} />
            <Label htmlFor="usar-ponto" className="text-[11px]">
              Usar ponto do Ahgora para hora extra
            </Label>
          </div>
          <div className="flex items-end">
            <Button size="sm" className="h-8" onClick={apurar} disabled={q.isFetching}>
              <Play className="mr-1.5 h-3 w-3" />
              {q.isFetching ? "Apurando…" : "Apurar"}
            </Button>
          </div>
        </div>

        {q.data && (
          <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-border/60 pt-3">
            <div className="space-y-1">
              <Label className="text-[11px]">Função</Label>
              <Select value={funcao} onValueChange={setFuncao}>
                <SelectTrigger className="h-8 w-[150px] text-[12px]" aria-label="Função">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas</SelectItem>
                  <SelectItem value="Motorista">Motorista</SelectItem>
                  <SelectItem value="Ajudante">Ajudante</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Hora extra</Label>
              <Select value={horaExtra} onValueChange={setHoraExtra}>
                <SelectTrigger className="h-8 w-[190px] text-[12px]" aria-label="Hora extra">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas</SelectItem>
                  <SelectItem value="sim">Fez hora extra</SelectItem>
                  <SelectItem value="nao">Não fez</SelectItem>
                  <SelectItem value="sem_ponto">Sem registro de ponto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtrando && (
              <p className="pb-2 text-[11px] text-amber-600">
                Filtro ativo: os totais abaixo somam só {linhas.length} de {todasLinhas.length}{" "}
                lançamentos.
              </p>
            )}
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Com o ponto ligado, a apuração consulta o Ahgora colaborador por colaborador e leva alguns
          segundos a mais. Sem ele, ninguém chega a Turbo.
        </p>
      </section>

      {q.error && (
        <div className="rounded-[10px] border border-destructive/40 bg-destructive/5 p-3 text-[12px] text-destructive">
          {mensagemAmigavel(q.error)}
        </div>
      )}

      {q.isFetching ? (
        <div className="space-y-2 rounded-[10px] border border-border/70 bg-card p-3">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : q.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            {[
              { rotulo: "Colaboradores", valor: String(pessoas.length), alerta: false },
              {
                rotulo: "NFs entregues",
                valor: String(linhas.reduce((a, l) => a + l.nfsEntregues, 0)),
                alerta: false,
              },
              { rotulo: "Custo total", valor: formatarMoeda(total), alerta: false },
              { rotulo: "Dias sem ponto", valor: String(semPonto), alerta: semPonto > 0 },
            ].map((k) => (
              <div key={k.rotulo} className="rounded-[10px] border border-border/70 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">{k.rotulo}</p>
                <p
                  className={`text-[20px] font-medium tabular-nums ${k.alerta ? "text-amber-600" : ""}`}
                >
                  {k.valor}
                </p>
              </div>
            ))}
          </section>

          {pendentes > 0 && (
            <div className="flex items-start gap-2 rounded-[10px] border border-amber-500/40 bg-amber-500/5 p-3 text-[12px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {pendentes} de {linhas.length} linhas têm NF sem desfecho registrado no dia. Elas
                contam como entregues, então o valor apurado pode cair quando as ocorrências
                fecharem.
              </span>
            </div>
          )}

          <Abas
            abas={[
              { valor: "pessoa", rotulo: "Por colaborador" },
              { valor: "dia", rotulo: "Por dia" },
            ]}
            padrao="pessoa"
            classeDaAba="text-[12px]"
          >
            <ConteudoDaAba valor="pessoa">
              <section className="overflow-x-auto rounded-[10px] border border-border/70 bg-card">
                <table className="w-full text-[12px]">
                  <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Colaborador</th>
                      <th className="px-3 py-2 text-right">Dias</th>
                      <th className="px-3 py-2 text-right">NFs entregues</th>
                      <th className="px-3 py-2 text-right">Retornos</th>
                      <th className="px-3 py-2 text-right">Êxito médio</th>
                      <th className="px-3 py-2 text-right">Dias Turbo</th>
                      <th className="px-3 py-2 text-right">Sem bônus</th>
                      <th className="px-3 py-2 text-right">Hora extra</th>
                      <th className="px-3 py-2 text-right">Sem ponto</th>
                      <th className="px-3 py-2 text-right">Bônus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {pessoas.map((p) => (
                      <LinhaPessoa key={p.colaborador} p={p} />
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/30 text-[12px] font-medium">
                    <tr>
                      <td className="px-3 py-2">Total do período</td>
                      <td colSpan={8} />
                      <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </section>
            </ConteudoDaAba>

            <ConteudoDaAba valor="dia">
              <section className="overflow-x-auto rounded-[10px] border border-border/70 bg-card">
                <table className="w-full text-[12px]">
                  <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Dia</th>
                      <th className="px-3 py-2 text-right">Veículos</th>
                      <th className="px-3 py-2 text-right">Pessoas</th>
                      <th className="px-3 py-2 text-right">NFs entregues</th>
                      <th className="px-3 py-2 text-right">Turbo</th>
                      <th className="px-3 py-2 text-right">Acelerado</th>
                      <th className="px-3 py-2 text-right">Em rota</th>
                      <th className="px-3 py-2 text-right">Sem bônus</th>
                      <th className="px-3 py-2 text-right">Custo do dia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {porDia.map(([dia, ls]) => (
                      <tr key={dia}>
                        <td className="px-3 py-1.5 font-mono">{formatarDiaMes(dia)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {new Set(ls.map((l) => l.romaneio)).size}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{ls.length}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {ls.reduce((a, l) => a + l.nfsEntregues, 0)}
                        </td>
                        {NIVEIS_DE_BONIFICACAO.map((n) => (
                          <td key={n} className="px-3 py-1.5 text-right tabular-nums">
                            {ls.filter((l) => l.nivel === n).length}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {formatarMoeda(
                            ls.reduce((a, l) => a + Math.round(l.bonus * 10_000), 0) / 10_000,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </ConteudoDaAba>
          </Abas>
        </>
      ) : (
        <div className="rounded-[10px] border border-dashed border-border/70 p-8 text-center text-[12px] text-muted-foreground">
          Escolha o mês e a unidade e clique em “Apurar”.
        </div>
      )}

      {/* key: trocar o mês recomeça o formulário no dia 1 do mês novo. */}
      <QuadroDeFaltas key={mes} mes={mes} />
    </div>
  );
}
