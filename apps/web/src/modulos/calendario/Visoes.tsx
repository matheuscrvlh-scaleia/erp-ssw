import { unidadesImpactadas } from "@erp/dominio/calendario";
import { type Feriado, type UnidadeDoCalendario } from "@erp/shared/contratos/calendario";
import { diferencaEmDias } from "@erp/shared/datas";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";

import {
  corDoTipo,
  formatarDiaCurto,
  MESES_LONGOS,
  montarGradeDoMes,
  SEMANA,
  textoDaDistancia,
} from "./calendario";

type FeriadosPorData = Map<string, Feriado[]>;

function nomesDasUnidades(unidades: readonly UnidadeDoCalendario[]): string {
  return unidades.length === 0
    ? "nenhuma unidade cadastrada"
    : unidades.map((u) => u.nome).join(", ");
}

export function VisaoMes({
  ano,
  mes,
  hoje,
  aoMudarMes,
  feriadosPorData,
  unidades,
}: {
  ano: number;
  mes: number;
  hoje: string;
  aoMudarMes: (mes: number) => void;
  feriadosPorData: FeriadosPorData;
  unidades: UnidadeDoCalendario[];
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => {
            aoMudarMes((mes + 11) % 12);
          }}
          className="rounded p-1 hover:bg-muted"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-[14px] font-medium">
          {MESES_LONGOS[mes]} {ano}
        </h3>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => {
            aoMudarMes((mes + 1) % 12);
          }}
          className="rounded p-1 hover:bg-muted"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground uppercase">
        {SEMANA.map((s, i) => (
          <div key={i} className="py-1">
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {montarGradeDoMes(ano, mes).map((d) => (
          <Dia
            key={d.iso}
            iso={d.iso}
            dia={d.dia}
            outroMes={d.outroMes}
            ehHoje={d.iso === hoje}
            feriados={feriadosPorData.get(d.iso) ?? []}
            unidades={unidades}
          />
        ))}
      </div>
      <Legenda />
    </div>
  );
}

function Dia({
  iso,
  dia,
  outroMes,
  ehHoje,
  feriados,
  unidades,
}: {
  iso: string;
  dia: number;
  outroMes: boolean;
  ehHoje: boolean;
  feriados: Feriado[];
  unidades: UnidadeDoCalendario[];
}) {
  const [principal] = feriados;
  const anelDeHoje = ehHoje ? "ring-1 ring-primary" : "";
  if (!principal) {
    return (
      <div
        className={`aspect-square rounded border border-border/40 p-1 text-[12px] ${outroMes ? "opacity-30" : ""} ${anelDeHoje}`}
      >
        <div className="tabular-nums">{dia}</div>
      </div>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`aspect-square rounded border p-1 text-left text-[12px] ${corDoTipo(principal.tipo)} ${outroMes ? "opacity-50" : ""} ${anelDeHoje}`}
        >
          <div className="font-medium tabular-nums">{dia}</div>
          <div className="truncate text-[10px] opacity-90">{principal.descricao}</div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-[12px]">
        <p className="font-medium">{formatarDiaCurto(iso)}</p>
        <div className="mt-2 space-y-2">
          {feriados.map((f) => (
            <div key={f.id} className="rounded border border-border/40 p-2">
              <div className="flex items-center gap-2">
                <EtiquetaDoTipo tipo={f.tipo} />
                <span className="font-medium">{f.descricao}</span>
              </div>
              {(f.cidade ?? f.uf) && (
                <p className="mt-1 text-muted-foreground">
                  {[f.cidade, f.uf].filter(Boolean).join(" / ")}
                </p>
              )}
              <p className="mt-1 text-muted-foreground">
                Impacta {nomesDasUnidades(unidadesImpactadas(f, unidades))}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EtiquetaDoTipo({ tipo }: { tipo: Feriado["tipo"] }) {
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] capitalize ${corDoTipo(tipo)}`}>
      {tipo}
    </span>
  );
}

function Legenda() {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
      <span className={`rounded border px-1.5 py-0.5 ${corDoTipo("nacional")}`}>Nacional</span>
      <span className={`rounded border px-1.5 py-0.5 ${corDoTipo("estadual")}`}>Estadual</span>
      <span className={`rounded border px-1.5 py-0.5 ${corDoTipo("municipal")}`}>Municipal</span>
    </div>
  );
}

export function VisaoAno({
  ano,
  feriadosPorData,
  aoEscolherMes,
}: {
  ano: number;
  feriadosPorData: FeriadosPorData;
  aoEscolherMes: (mes: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MESES_LONGOS.map((nomeDoMes, mes) => (
        <button
          type="button"
          key={nomeDoMes}
          onClick={() => {
            aoEscolherMes(mes);
          }}
          className="rounded-lg border border-border/60 bg-card p-3 text-left hover:border-primary/40"
        >
          <h4 className="mb-2 text-[12px] font-medium">{nomeDoMes}</h4>
          <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] text-muted-foreground">
            {SEMANA.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {montarGradeDoMes(ano, mes).map((d) => {
              const [principal] = feriadosPorData.get(d.iso) ?? [];
              return (
                <div
                  key={d.iso}
                  title={principal?.descricao ?? ""}
                  className={`flex aspect-square items-center justify-center rounded text-[9px] tabular-nums ${d.outroMes ? "opacity-20" : ""} ${principal ? `${corDoTipo(principal.tipo)} border` : ""}`}
                >
                  {d.dia}
                </div>
              );
            })}
          </div>
        </button>
      ))}
    </div>
  );
}

export function VisaoLista({
  feriados,
  unidades,
  hoje,
  podeEditar,
  aoEditar,
  aoExcluir,
}: {
  feriados: Feriado[];
  unidades: UnidadeDoCalendario[];
  hoje: string;
  podeEditar: boolean;
  aoEditar: (f: Feriado) => void;
  aoExcluir: (f: Feriado) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
      <table className="w-full text-[13px]">
        <thead className="border-b border-border/60 text-[11px] tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 text-left">Data</th>
            <th className="px-3 py-2 text-left">Dias</th>
            <th className="px-3 py-2 text-left">Descrição</th>
            <th className="px-3 py-2 text-left">Tipo</th>
            <th className="px-3 py-2 text-left">Local</th>
            <th className="px-3 py-2 text-left">Unidades impactadas</th>
            {podeEditar && <th className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody>
          {feriados.map((f) => {
            const impactadas = unidadesImpactadas(f, unidades);
            return (
              <tr key={f.id} className="border-b border-border/30 hover:bg-muted/30">
                <td className="px-3 py-2 tabular-nums">{formatarDiaCurto(f.data)}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {textoDaDistancia(diferencaEmDias(hoje, f.data))}
                </td>
                <td className="px-3 py-2">
                  {podeEditar ? (
                    <button
                      type="button"
                      className="hover:underline"
                      onClick={() => {
                        aoEditar(f);
                      }}
                    >
                      {f.descricao}
                    </button>
                  ) : (
                    f.descricao
                  )}
                  {f.geradoAutomaticamente && (
                    <span className="ml-2 text-[10px] text-muted-foreground">(gerado)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <EtiquetaDoTipo tipo={f.tipo} />
                </td>
                <td className="px-3 py-2">{[f.cidade, f.uf].filter(Boolean).join(" / ") || "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {impactadas.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">nenhuma</span>
                    ) : (
                      impactadas.slice(0, 4).map((u) => (
                        <span
                          key={u.id}
                          className="rounded border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px]"
                        >
                          {u.nome}
                        </span>
                      ))
                    )}
                    {impactadas.length > 4 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{impactadas.length - 4}
                      </span>
                    )}
                  </div>
                </td>
                {podeEditar && (
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`Excluir ${f.descricao}`}
                      onClick={() => {
                        aoExcluir(f);
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
