import { unidadesImpactadas } from "@erp/domain/calendar";
import { type Feriado, type UnidadeDoCalendario } from "@erp/shared/contracts/calendar";
import { diferencaEmDias } from "@erp/shared/dates";
import { Trash2 } from "lucide-react";

import { type ColunaTabela } from "@/components/common/data-table";
import { TabelaDados } from "@/components/common/DataTable";
import { EtiquetaDoTipo } from "@/components/common/TypeTag";
import { Button } from "@/components/ui/button";

import { formatarDiaCurto, localDo, textoDaDistancia } from "../texts";

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
