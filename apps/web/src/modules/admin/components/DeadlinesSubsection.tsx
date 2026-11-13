import { type PrazoConfigurado } from "@erp/shared/contracts/admin";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { type ReactNode } from "react";

import { SeloStatus } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** Um tipo de regra (unidade, parceiro, transbordo): a lista com ligar, editar e remover. */
export function SubSecaoDePrazos({
  titulo,
  descricao,
  regras,
  descrever,
  aoAdicionar,
  aoEditar,
  aoLigar,
  aoExcluir,
}: {
  titulo: string;
  descricao: string;
  regras: PrazoConfigurado[];
  descrever: (r: PrazoConfigurado) => ReactNode;
  aoAdicionar: () => void;
  aoEditar: (r: PrazoConfigurado) => void;
  aoLigar: (r: PrazoConfigurado, ativo: boolean) => void;
  aoExcluir: (r: PrazoConfigurado) => void;
}) {
  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-foreground">{titulo}</h3>
          <p className="text-[12.5px] text-muted-foreground">{descricao}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={aoAdicionar}
          className="shrink-0"
          aria-label={`Adicionar ${titulo.toLowerCase()}`}
        >
          <Plus aria-hidden />
          Adicionar
        </Button>
      </div>
      {regras.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-muted-foreground">
          Nenhuma regra cadastrada.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {regras.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px] hover:bg-muted/60"
            >
              <div
                className={`flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-0.5 ${r.ativo ? "" : "opacity-60"}`}
              >
                {descrever(r)}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <label className="mr-1 flex items-center gap-2">
                  <Switch
                    checked={r.ativo}
                    onCheckedChange={(ativo) => {
                      aoLigar(r, ativo);
                    }}
                    aria-label="Ativo"
                  />
                  <SeloStatus tom={r.ativo ? "sucesso" : "neutro"}>
                    {r.ativo ? "Ativa" : "Inativa"}
                  </SeloStatus>
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => {
                    aoEditar(r);
                  }}
                  aria-label="Editar"
                  title="Editar"
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-status-bad-fg hover:text-status-bad-fg"
                  onClick={() => {
                    aoExcluir(r);
                  }}
                  aria-label="Remover"
                  title="Remover"
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
