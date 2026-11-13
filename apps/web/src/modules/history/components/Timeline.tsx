import { type Feriado } from "@erp/shared/contracts/calendar";
import { type Anotacao, ROTULO_DO_TIPO_DE_ANOTACAO } from "@erp/shared/contracts/history";
import { CalendarDays, Pencil } from "lucide-react";
import { useState } from "react";

import { corDoTipo } from "@/components/common/holiday-type";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { type DiaDoHistorico } from "../rules";
import { COR_DO_TIPO, diaPorExtenso, ICONE_DO_TIPO } from "../texts";

function ItemDeAnotacao({ a, aoEditar }: { a: Anotacao; aoEditar: (() => void) | null }) {
  const Icone = ICONE_DO_TIPO[a.tipo];
  const conteudo = (
    <>
      <span
        aria-hidden
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          COR_DO_TIPO[a.tipo].icone,
        )}
      >
        <Icone className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-pre-line text-foreground">{a.texto}</span>
        <span className="mt-1 block text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {ROTULO_DO_TIPO_DE_ANOTACAO[a.tipo]}
          </span>
          {a.unidadeNome && ` · ${a.unidadeNome}`}
          {a.autorNome && ` · ${a.autorNome}`}
        </span>
      </span>
      {aoEditar && (
        <Pencil
          className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        />
      )}
    </>
  );
  const classe =
    "group flex w-full items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-[13px] shadow-cartao";
  return aoEditar ? (
    <button
      type="button"
      onClick={aoEditar}
      className={cn(
        classe,
        "transition-[border-color,box-shadow] hover:border-brand/40 hover:shadow-flutuante",
      )}
    >
      {conteudo}
    </button>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

function ItemDeFeriado({ f }: { f: Feriado }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3.5 py-3 text-[13px]",
        corDoTipo(f.tipo),
      )}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card/70"
      >
        <CalendarDays className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{f.descricao}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {f.tipo === "nacional"
            ? "Nacional"
            : [f.cidade, f.uf].filter(Boolean).join("/") || "Municipal"}
        </div>
      </div>
    </div>
  );
}

/** Linha do tempo por dia, do mais recente ao mais antigo (30 dias por vez). */
export function LinhaDoTempo({
  dias,
  editavel,
  aoEditar,
}: {
  dias: readonly DiaDoHistorico[];
  editavel: (a: Anotacao) => boolean;
  aoEditar: (a: Anotacao) => void;
}) {
  const [limite, setLimite] = useState(30);
  const visiveis = dias.slice(0, limite);
  return (
    <div className="space-y-4">
      <ol>
        {visiveis.map((d, i) => (
          <li key={d.dia} className="relative pb-6 pl-8 last:pb-0">
            {i < visiveis.length - 1 && (
              <span
                aria-hidden
                className="absolute top-5 -bottom-0.5 left-[8.5px] w-0.5 rounded-full bg-muted-foreground/35"
              />
            )}
            <span
              aria-hidden
              className="absolute top-1 left-[3px] h-[13px] w-[13px] rounded-full border-[3px] border-brand bg-card"
            />
            <h3 className="label-xs pt-0.5">{diaPorExtenso(d.dia)}</h3>
            <div className="mt-2.5 space-y-2">
              {d.feriados.map((f) => (
                <ItemDeFeriado key={f.id} f={f} />
              ))}
              {d.anotacoes.map((a) => (
                <ItemDeAnotacao
                  key={a.id}
                  a={a}
                  aoEditar={
                    editavel(a)
                      ? () => {
                          aoEditar(a);
                        }
                      : null
                  }
                />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {dias.length > limite && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setLimite(limite + 30);
          }}
        >
          Mostrar mais dias
        </Button>
      )}
    </div>
  );
}
