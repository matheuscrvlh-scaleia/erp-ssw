import { type EntradaDe } from "@erp/shared/contrato";
import {
  type contratosAhgora as c,
  type FuncionarioApurado,
  type MOTIVOS_DE_REVISAO,
} from "@erp/shared/contratos/ahgora";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronRight, Play } from "lucide-react";
import { useState } from "react";

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

import { diaCurto, mesDe, periodoDoMes } from "../ranking/periodo";
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

function LinhaFuncionario({ f }: { f: FuncionarioApurado }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-muted/30"
        onClick={() => {
          setAberto((v) => !v);
        }}
        aria-expanded={aberto}
      >
        <td className="px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            {aberto ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className="font-medium">{f.name}</span>
            {f.demitido && (
              <Badge variant="destructive" className="text-[10px]">
                demitido
              </Badge>
            )}
          </div>
        </td>
        <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{f.register}</td>
        <td className="px-3 py-1.5 text-muted-foreground">{f.department || "—"}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{f.diasComRegistro}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">{formatarHoras(f.minutosApurados)}</td>
        <td className="px-3 py-1.5 text-right tabular-nums">
          {f.diasARevisar > 0 ? (
            <Badge variant="outline" className="border-amber-500/60 text-[10px] text-amber-600">
              {f.diasARevisar}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>

      {aberto && (
        <tr>
          <td colSpan={6} className="bg-muted/20 px-3 py-2">
            {f.dias.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma batida registrada no período.
              </p>
            ) : (
              <table className="w-full text-[11px]">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-medium">Dia</th>
                    <th className="py-1 text-left font-medium">Batidas</th>
                    <th className="py-1 text-right font-medium">Horas</th>
                  </tr>
                </thead>
                <tbody>
                  {f.dias.map((d) => (
                    <tr key={d.data} className="border-t border-border/30">
                      <td className="py-1 align-top font-mono">{diaCurto(d.data)}</td>
                      <td className="py-1">
                        <div className="flex flex-wrap gap-1">
                          {d.batidas.map((b, i) => (
                            <span
                              key={`${b.hora}-${i}`}
                              className={`rounded px-1 font-mono ${
                                b.tipo === "DELETADA"
                                  ? "text-destructive line-through"
                                  : "bg-background"
                              }`}
                              title={b.tipo}
                            >
                              {b.hora}
                            </span>
                          ))}
                        </div>
                        {d.motivoRevisao && (
                          <p className="mt-0.5 flex items-start gap-1 text-[10px] text-amber-600">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            {MOTIVO_LABEL[d.motivoRevisao]}
                          </p>
                        )}
                      </td>
                      <td className="py-1 text-right align-top tabular-nums">
                        {d.minutosTrabalhados === null ? (
                          <span className="text-amber-600">revisar</span>
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
export function ApuracaoPonto() {
  const [mes, setMes] = useState(() => mesDe(new Date()));
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
    <div className="space-y-4">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-medium tracking-tight">Apuração de ponto (Ahgora)</h1>
          <ComoFuncionaPonto />
        </div>
        <p className="text-[12px] text-muted-foreground">
          Marcações de ponto por colaborador e período, consolidadas direto do Ahgora. Dias que não
          fecham com segurança aparecem como “revisar” em vez de receberem um total estimado.
        </p>
      </header>

      <section className="rounded-[10px] border border-border/70 bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_auto]">
          <div className="space-y-1">
            <Label htmlFor="ponto-mes" className="text-[11px]">
              Mês
            </Label>
            <Input
              id="ponto-mes"
              type="month"
              className="h-8 text-[12px]"
              value={mes}
              onChange={(e) => {
                setMes(e.target.value);
              }}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px]">Departamento</Label>
            <Select value={departamento} onValueChange={setDepartamento}>
              <SelectTrigger className="h-8 text-[12px]" aria-label="Departamento">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os departamentos</SelectItem>
                {(departamentos.data ?? []).map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2 pb-1.5">
            <Switch
              id="incluir-demitidos"
              checked={incluirDemitidos}
              onCheckedChange={setIncluirDemitidos}
            />
            <Label htmlFor="incluir-demitidos" className="text-[11px]">
              Incluir demitidos
            </Label>
          </div>

          <div className="flex items-end">
            <Button size="sm" className="h-8" onClick={apurar} disabled={apuracao.isFetching}>
              <Play className="mr-1.5 h-3 w-3" />
              {apuracao.isFetching ? "Apurando…" : "Apurar"}
            </Button>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-muted-foreground">
          A consulta busca as batidas de um colaborador por vez no Ahgora, então apurar um
          departamento leva alguns segundos. Períodos maiores que um mês não são aceitos pela API.
        </p>
      </section>

      {apuracao.error && (
        <div className="rounded-[10px] border border-destructive/40 bg-destructive/5 p-3 text-[12px] text-destructive">
          {apuracao.error.message}
        </div>
      )}

      {apuracao.isFetching ? (
        <div className="space-y-2 rounded-[10px] border border-border/70 bg-card p-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : apuracao.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            {[
              { rotulo: "Colaboradores", valor: String(funcionarios.length), alerta: false },
              {
                rotulo: "Dias com registro",
                valor: String(funcionarios.reduce((a, f) => a + f.diasComRegistro, 0)),
                alerta: false,
              },
              { rotulo: "Horas apuradas", valor: formatarHoras(totalMinutos), alerta: false },
              { rotulo: "Dias a revisar", valor: String(totalRevisar), alerta: totalRevisar > 0 },
            ].map((card) => (
              <div key={card.rotulo} className="rounded-[10px] border border-border/70 bg-card p-3">
                <p className="text-[11px] text-muted-foreground">{card.rotulo}</p>
                <p
                  className={`text-[20px] font-medium tabular-nums ${
                    card.alerta ? "text-amber-600" : ""
                  }`}
                >
                  {card.valor}
                </p>
              </div>
            ))}
          </section>

          <section className="rounded-[10px] border border-border/70 bg-card">
            <header className="border-b border-border/70 px-3 py-2">
              <h2 className="text-[13px] font-medium">
                Colaboradores · {dataBr(apuracao.data.inicio)} a {dataBr(apuracao.data.fim)}
              </h2>
            </header>

            {funcionarios.length === 0 ? (
              <p className="p-6 text-center text-[12px] text-muted-foreground">
                Nenhum colaborador encontrado para os filtros selecionados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Colaborador</th>
                      <th className="px-3 py-2 text-left">Matrícula</th>
                      <th className="px-3 py-2 text-left">Departamento</th>
                      <th className="px-3 py-2 text-right">Dias</th>
                      <th className="px-3 py-2 text-right">Horas apuradas</th>
                      <th className="px-3 py-2 text-right">A revisar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {funcionarios.map((f) => (
                      <LinhaFuncionario key={f.register} f={f} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="rounded-[10px] border border-dashed border-border/70 p-8 text-center text-[12px] text-muted-foreground">
          Escolha o mês e o departamento e clique em “Apurar”.
        </div>
      )}
    </div>
  );
}
