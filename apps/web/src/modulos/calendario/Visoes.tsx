import { unidadesImpactadas } from "@erp/dominio/calendario";
import { type Feriado, type UnidadeDoCalendario } from "@erp/shared/contratos/calendario";
import { diferencaEmDias } from "@erp/shared/datas";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

import { Painel } from "@/componentes/comum/Painel";
import { type ColunaTabela } from "@/componentes/comum/tabela-dados";
import { TabelaDados } from "@/componentes/comum/TabelaDados";
import { Button } from "@/componentes/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { cn } from "@/lib/utils";

import {
  corDoTipo,
  formatarDiaCurto,
  MESES_LONGOS,
  montarGradeDoMes,
  PONTO_DO_TIPO,
  SEMANA,
  textoDaDistancia,
} from "./calendario";

type FeriadosPorData = Map<string, Feriado[]>;

function nomesDasUnidades(unidades: readonly UnidadeDoCalendario[]): string {
  return unidades.length === 0
    ? "nenhuma unidade cadastrada"
    : unidades.map((u) => u.nome).join(", ");
}

const localDo = (f: Feriado) => [f.cidade, f.uf].filter(Boolean).join(" / ");

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
    <Painel
      titulo={`${MESES_LONGOS[mes] ?? ""} ${String(ano)}`}
      acoes={
        <>
          <Button
            size="sm"
            variant="outline"
            className="w-8 px-0"
            aria-label="Mês anterior"
            title="Mês anterior"
            onClick={() => {
              aoMudarMes((mes + 11) % 12);
            }}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-8 px-0"
            aria-label="Próximo mês"
            title="Próximo mês"
            onClick={() => {
              aoMudarMes((mes + 1) % 12);
            }}
          >
            <ChevronRight aria-hidden />
          </Button>
        </>
      }
      rodape={<Legenda />}
      classeDoCorpo="p-3 sm:p-4"
    >
      <div className="grid grid-cols-7 gap-1 pb-1.5 text-center sm:gap-1.5">
        {SEMANA.map((s, i) => (
          <div key={i} className="label-xs">
            {s}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
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
    </Painel>
  );
}

const CELULA = "flex min-h-14 flex-col rounded-lg border p-1.5 text-left text-[13px] sm:min-h-20";

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
  const numero = (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full tabular-nums",
        ehHoje && "bg-primary font-bold text-primary-foreground",
      )}
    >
      {dia}
    </span>
  );
  if (!principal) {
    return (
      <div
        aria-current={ehHoje ? "date" : undefined}
        className={cn(CELULA, "border-border bg-card text-foreground", outroMes && "opacity-35")}
      >
        {numero}
      </div>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-current={ehHoje ? "date" : undefined}
          aria-label={`${formatarDiaCurto(iso)}: ${feriados.map((f) => f.descricao).join(", ")}`}
          className={cn(
            CELULA,
            "transition-shadow hover:shadow-flutuante",
            corDoTipo(principal.tipo),
            outroMes && "opacity-50",
          )}
        >
          <span className="font-semibold">{numero}</span>
          <span className="mt-auto hidden truncate text-xs leading-snug sm:block">
            {principal.descricao}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-[13px]">
        <p className="font-semibold">{formatarDiaCurto(iso)}</p>
        <div className="mt-2 space-y-2">
          {feriados.map((f) => (
            <div key={f.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center gap-2">
                <EtiquetaDoTipo tipo={f.tipo} />
                <span className="font-semibold">{f.descricao}</span>
              </div>
              {(f.cidade ?? f.uf) && <p className="mt-1 text-muted-foreground">{localDo(f)}</p>}
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Impacta {nomesDasUnidades(unidadesImpactadas(f, unidades))}
              </p>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Selo do tipo de feriado (texto + cor da categoria). */
export function EtiquetaDoTipo({ tipo }: { tipo: Feriado["tipo"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[12px] font-semibold capitalize",
        corDoTipo(tipo),
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", PONTO_DO_TIPO[tipo])} />
      {tipo}
    </span>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <EtiquetaDoTipo tipo="nacional" />
      <EtiquetaDoTipo tipo="estadual" />
      <EtiquetaDoTipo tipo="municipal" />
    </div>
  );
}

export function VisaoAno({
  ano,
  hoje,
  feriadosPorData,
  aoEscolherMes,
}: {
  ano: number;
  hoje: string;
  feriadosPorData: FeriadosPorData;
  aoEscolherMes: (mes: number) => void;
}) {
  return (
    <Painel titulo={String(ano)} rodape={<Legenda />} classeDoCorpo="p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MESES_LONGOS.map((nomeDoMes, mes) => {
          const grade = montarGradeDoMes(ano, mes);
          return (
            <button
              type="button"
              key={nomeDoMes}
              onClick={() => {
                aoEscolherMes(mes);
              }}
              className="rounded-xl border border-border bg-card p-3 text-left transition-[box-shadow,border-color] hover:border-brand/40 hover:shadow-flutuante"
            >
              <span className="mb-2 block text-[13px] font-semibold">{nomeDoMes}</span>
              <span className="grid grid-cols-7 gap-0.5 text-center text-xs text-muted-foreground">
                {SEMANA.map((s, i) => (
                  <span key={i}>{s}</span>
                ))}
              </span>
              <span className="mt-0.5 grid grid-cols-7 gap-0.5">
                {grade.map((d) => {
                  const [principal] = feriadosPorData.get(d.iso) ?? [];
                  return (
                    <span
                      key={d.iso}
                      title={principal?.descricao ?? ""}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md border border-transparent text-xs tabular-nums",
                        d.outroMes && "opacity-25",
                        principal && cn(corDoTipo(principal.tipo), "font-semibold"),
                        d.iso === hoje && "ring-1 ring-brand",
                      )}
                    >
                      {d.dia}
                    </span>
                  );
                })}
              </span>
            </button>
          );
        })}
      </div>
    </Painel>
  );
}

export function VisaoLista({
  feriados,
  unidades,
  hoje,
  podeEditar,
  podeExcluir,
  aoEditar,
  aoExcluir,
}: {
  feriados: Feriado[];
  unidades: UnidadeDoCalendario[];
  hoje: string;
  podeEditar: boolean;
  podeExcluir: boolean;
  aoEditar: (f: Feriado) => void;
  aoExcluir: (f: Feriado) => void;
}) {
  const colunas: ColunaTabela<Feriado>[] = [
    {
      chave: "data",
      titulo: "Data",
      celula: (f) => formatarDiaCurto(f.data),
      classe: "whitespace-nowrap",
    },
    {
      chave: "dias",
      titulo: "Dias",
      valor: (f) => diferencaEmDias(hoje, f.data),
      celula: (f) => (
        <span className="text-muted-foreground">
          {textoDaDistancia(diferencaEmDias(hoje, f.data))}
        </span>
      ),
      alinhamento: "esquerda",
      classe: "whitespace-nowrap",
    },
    {
      chave: "descricao",
      titulo: "Descrição",
      celula: (f) => (
        <>
          {podeEditar ? (
            <button
              type="button"
              className="font-semibold text-foreground hover:text-brand hover:underline"
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
            <span className="ml-2 text-xs text-muted-foreground">(gerado)</span>
          )}
        </>
      ),
    },
    { chave: "tipo", titulo: "Tipo", celula: (f) => <EtiquetaDoTipo tipo={f.tipo} /> },
    { chave: "local", titulo: "Local", valor: (f) => localDo(f) || "—" },
    {
      chave: "unidades",
      titulo: "Unidades impactadas",
      ordenavel: false,
      celula: (f) => <UnidadesImpactadas impactadas={unidadesImpactadas(f, unidades)} />,
    },
    ...(podeExcluir
      ? [
          {
            chave: "acoes",
            titulo: "",
            ordenavel: false,
            alinhamento: "direita" as const,
            celula: (f: Feriado) => (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
                aria-label={`Excluir ${f.descricao}`}
                title={`Excluir ${f.descricao}`}
                onClick={() => {
                  aoExcluir(f);
                }}
              >
                <Trash2 aria-hidden />
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <TabelaDados
      colunas={colunas}
      linhas={feriados}
      chaveDaLinha={(f) => f.id}
      porPagina={0}
      rotuloTotal={(n) => `${String(n)} feriado(s)`}
    />
  );
}

function UnidadesImpactadas({ impactadas }: { impactadas: readonly UnidadeDoCalendario[] }) {
  if (impactadas.length === 0) {
    return <span className="text-xs text-muted-foreground">nenhuma</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {impactadas.slice(0, 4).map((u) => (
        <span
          key={u.id}
          className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs whitespace-nowrap"
        >
          {u.nome}
        </span>
      ))}
      {impactadas.length > 4 && (
        <span className="self-center text-xs text-muted-foreground">+{impactadas.length - 4}</span>
      )}
    </div>
  );
}
