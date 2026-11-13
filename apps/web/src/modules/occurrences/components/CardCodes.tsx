import { type Card, type FiltrosDeCte } from "@erp/shared/contracts/occurrences";
import { formatarInteiro, formatarParticipacao } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";
import { ListTree, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { ExportMenu } from "@/components/common/ExportMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mensagemAmigavel } from "@/lib/error-message";

import { consultaCodigosDoCard } from "../api";

/** "ver códigos": os códigos que compõem o número do card, com busca e exportação. */
export function CodigosDoCard({
  card,
  filtros,
  titulo,
  aoEscolher,
}: {
  card: Card;
  filtros: FiltrosDeCte;
  titulo: string;
  aoEscolher: (codigo: number) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const consulta = useQuery({ ...consultaCodigosDoCard(filtros, card), enabled: aberto });
  const codigos = useMemo(() => consulta.data?.codigos ?? [], [consulta.data]);
  const total = codigos.reduce((s, c) => s + c.total, 0);
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return codigos;
    return codigos.filter(
      (c) => String(c.codigo).includes(termo) || c.descricao.toLowerCase().includes(termo),
    );
  }, [codigos, busca]);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Ver os códigos que compõem este número"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-brand transition-colors hover:bg-brand-suave"
        >
          <ListTree className="h-3.5 w-3.5" aria-hidden />
          ver códigos
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
          <div>
            <div className="text-[13px] font-semibold">{titulo}</div>
            <div className="text-xs text-muted-foreground">
              {consulta.isLoading
                ? "Carregando…"
                : `${formatarInteiro(codigos.length)} código(s) no período · ordenado por volume`}
            </div>
          </div>
          <ExportMenu
            arquivo="ocorrencias-codigos"
            titulo={titulo}
            soIcone
            linhas={codigos.map((c) => ({ ...c, participacao: total > 0 ? c.total / total : 0 }))}
            colunas={[
              { chave: "codigo", titulo: "Código" },
              { chave: "descricao", titulo: "Descrição" },
              { chave: "total", titulo: "Total", formato: "inteiro" },
              {
                chave: "participacao",
                titulo: "% das ocorrências do grupo",
                formato: "percentual",
              },
            ]}
          />
        </div>
        <div className="relative border-b border-border px-2 py-2">
          <Search
            className="pointer-events-none absolute top-1/2 left-4 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={busca}
            aria-label="Buscar código ou descrição"
            onChange={(e) => {
              setBusca(e.target.value);
            }}
            placeholder="Buscar código ou descrição"
            className="h-8 w-full rounded-md border border-border bg-card pl-8 text-[13px] outline-none focus:border-brand"
          />
        </div>
        <ul className="max-h-[300px] overflow-auto py-1">
          {consulta.isLoading && (
            <li className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Carregando códigos…
            </li>
          )}
          {consulta.isError && (
            <li className="px-3 py-4 text-[13px] text-status-bad-fg">
              {mensagemAmigavel(consulta.error)}
            </li>
          )}
          {consulta.isSuccess && visiveis.length === 0 && (
            <li className="px-3 py-4 text-center text-[13px] text-muted-foreground">
              Nenhum código encontrado.
            </li>
          )}
          {visiveis.map((c) => (
            <li key={c.codigo}>
              <button
                type="button"
                onClick={() => {
                  aoEscolher(c.codigo);
                  setAberto(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-muted"
              >
                <span className="font-mono text-xs text-muted-foreground">
                  #{String(c.codigo).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate">{c.descricao}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatarInteiro(c.total)} · {formatarParticipacao(c.total, total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
