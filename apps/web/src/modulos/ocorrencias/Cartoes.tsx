import { type Card, type FiltrosDeCte } from "@erp/shared/contratos/ocorrencias";
import { useQuery } from "@tanstack/react-query";
import { ListTree, Loader2, Search } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { inteiro, participacao } from "@/modulos/compartilhado/formatos";
import { InfoTip } from "@/modulos/compartilhado/InfoTip";

import { consultaCodigosDoCard } from "./api";

const COR_DO_TOM = {
  ruim: "var(--kpi-volume)",
  alerta: "var(--kpi-alert)",
  normal: "var(--kpi-positive)",
} as const;

/** Card de métrica: clicar escolhe o recorte de responsabilidade da tela inteira. */
export function CartaoDeMetrica({
  rotulo,
  valor,
  apoio,
  selo,
  tom = "normal",
  dica,
  ativo,
  aoClicar,
  extra,
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  selo?: string;
  tom?: keyof typeof COR_DO_TOM;
  dica: string;
  ativo: boolean;
  aoClicar: () => void;
  extra?: ReactNode;
}) {
  const cor = COR_DO_TOM[tom];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={ativo}
      onClick={aoClicar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          aoClicar();
        }
      }}
      style={{ borderLeftColor: cor, borderLeftWidth: 5 }}
      className={
        "cursor-pointer rounded-[10px] border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40 " +
        (ativo ? "border-[var(--brand)]" : "border-border/70")
      }
    >
      <div className="flex items-center gap-1.5">
        <div className="text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
          {rotulo}
        </div>
        <InfoTip texto={dica} />
        {selo && (
          <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">
            {selo}
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[28px] font-bold tabular-nums" style={{ color: cor }}>
        {valor}
      </div>
      <div className="text-[13px] font-semibold text-muted-foreground">{apoio}</div>
      {extra && <div className="mt-1">{extra}</div>}
    </div>
  );
}

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
          onClick={(e) => {
            e.stopPropagation();
          }}
          title="Ver os códigos que compõem este número"
          className="inline-flex items-center gap-1 rounded text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ListTree className="h-3 w-3" />
          ver códigos
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[340px] p-0"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border/70 px-3 py-2">
          <div>
            <div className="text-[12px] font-medium">{titulo}</div>
            <div className="text-[10px] text-muted-foreground">
              {consulta.isLoading
                ? "Carregando…"
                : `${inteiro(codigos.length)} código(s) no período · ordenado por volume`}
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
        <div className="relative border-b border-border/70 px-2 py-1.5">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            aria-label="Buscar código ou descrição"
            onChange={(e) => {
              setBusca(e.target.value);
            }}
            placeholder="Buscar código ou descrição"
            className="h-7 w-full rounded border border-border/70 bg-background pl-7 text-[12px]"
          />
        </div>
        <ul className="max-h-[300px] overflow-auto py-1">
          {consulta.isLoading && (
            <li className="flex items-center justify-center gap-2 py-6 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando códigos…
            </li>
          )}
          {consulta.isError && (
            <li className="px-3 py-4 text-[12px] text-[var(--status-bad)]">
              {mensagemAmigavel(consulta.error)}
            </li>
          )}
          {consulta.isSuccess && visiveis.length === 0 && (
            <li className="px-3 py-4 text-center text-[12px] text-muted-foreground">
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
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] hover:bg-muted/60"
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  #{String(c.codigo).padStart(2, "0")}
                </span>
                <span className="flex-1 truncate">{c.descricao}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {inteiro(c.total)} · {participacao(c.total, total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
