import { formatarDataHora } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { useState } from "react";

import { MensagemErro } from "@/components/common/ErrorMessage";
import { SeloStatus } from "@/components/common/StatusBadge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { consultaLinhaDoTempo } from "../api";

/** Linha do tempo de ocorrências do CT-e (sistema + importações do SSW). */
export function LinhaDoTempo({ sigla, numero }: { sigla: string; numero: string }) {
  const [aberto, setAberto] = useState(false);
  const q = useQuery({ ...consultaLinhaDoTempo(sigla, numero), enabled: aberto });
  const eventos = q.data ?? [];
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Ver linha do tempo de ocorrências"
          aria-label={`Linha do tempo do CTRC ${numero}`}
        >
          <History className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-0">
        <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">
          Linha do tempo · {numero}
        </div>
        <div className="rolagem-fina max-h-[320px] overflow-y-auto p-4">
          {q.isLoading && <div className="text-[13px] text-muted-foreground">Carregando…</div>}
          {q.isError && <MensagemErro erro={q.error} className="py-2" />}
          {q.isSuccess && eventos.length === 0 && (
            <div className="text-[13px] text-muted-foreground">Sem ocorrências registradas.</div>
          )}
          <ol className="space-y-3">
            {eventos.map((e, i) => (
              <li key={i} className="border-l-2 border-brand/40 pl-3 text-[13px]">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="tabular-nums">{formatarDataHora(e.dataHora)}</span>
                  {e.codigo && (
                    <SeloStatus tom="neutro" semIcone className="h-5">
                      {e.codigo}
                    </SeloStatus>
                  )}
                  <span className="ml-auto">{e.fonte === "ssw" ? "SSW" : "sistema"}</span>
                </div>
                <div className="text-foreground">{e.descricao ?? "—"}</div>
                {e.complemento && (
                  <div className="text-[12px] text-muted-foreground">{e.complemento}</div>
                )}
                {(e.unidade ?? e.usuario) && (
                  <div className="text-[12px] text-muted-foreground">
                    {[e.unidade, e.usuario].filter((t) => t !== null).join(" · ")}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </PopoverContent>
    </Popover>
  );
}
