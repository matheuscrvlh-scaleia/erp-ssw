import { linkDoSsw } from "@erp/dominio/ctrc/detalhe";
import { type LinhaLista, type OrdemLista } from "@erp/shared/contratos/listagem";
import { formatarData, formatarDataHora, formatarMoeda } from "@erp/shared/formatacao";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Clock, ExternalLink } from "lucide-react";
import { type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/componentes/ui/tooltip";
import { cn } from "@/lib/utils";

import { type Ordenacao } from "./api";
import { selo } from "./textos";

type Tom = "ruim_forte" | "ruim" | "atencao" | "bom";

const CLASSE_DO_TOM: Record<Tom, string> = {
  ruim_forte: "bg-status-bad text-white",
  ruim: "bg-status-bad-bg text-status-bad-fg",
  atencao: "bg-status-warn-bg text-status-warn-fg",
  bom: "bg-status-good-bg text-status-good-fg",
};

/** Atraso em selo: vermelho cheio se em aberto e atrasado, claro se entregue com atraso. */
function SeloDeAtraso({ atraso, entregue }: { atraso: number | null; entregue: boolean }) {
  const s = selo(atraso, entregue);
  if (!s) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        CLASSE_DO_TOM[s.tom],
      )}
      title={s.dica}
    >
      {s.texto}
    </span>
  );
}

function IconeDaOrdem({ ativa, direcao }: { ativa: boolean; direcao: "asc" | "desc" }) {
  if (!ativa) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" />;
  return direcao === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

/** Larguras (px) das 4 colunas fixas: NF, CT-e, Atraso, Cliente Destino. */
const LARGURAS_FIXAS = [110, 110, 140, 220] as const;
const ESQUERDAS_FIXAS = [0, 110, 220, 360] as const;

/** Em celular nada fica fixo (as colunas se sobreporiam); a partir de `md` as 4 primeiras ficam. */
function fixa(indice: 0 | 1 | 2 | 3, extra: string) {
  return {
    className: cn(
      "md:sticky md:bg-background",
      indice === 3 && "md:shadow-[1px_0_0_0_var(--border)]",
      extra,
    ),
    style: { left: ESQUERDAS_FIXAS[indice], minWidth: LARGURAS_FIXAS[indice] },
  };
}

const CABECALHO_FIXO = "px-2 py-2 z-20 top-0 bg-muted/95 backdrop-blur";
const TH = "whitespace-nowrap px-2 py-2";
const TD = "whitespace-nowrap px-2 py-1.5";
const nz = (v: string | null) => v ?? "—";
const numero = (n: number | null, casas = 0) =>
  n === null
    ? "—"
    : n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const COLUNAS = 27;

export function TabelaCtrcs({
  linhas,
  ordenacao,
  aoOrdenar,
  saiuComPrazoVencido,
}: {
  linhas: readonly LinhaLista[];
  ordenacao: Ordenacao;
  aoOrdenar: (ordem: OrdemLista) => void;
  /** Lista do recorte "Saíram para entrega com prazo vencido": toda linha atende. */
  saiuComPrazoVencido: boolean;
}) {
  const botaoDeOrdem = (rotulo: string, ordem: OrdemLista): ReactNode => (
    <button
      type="button"
      onClick={() => {
        aoOrdenar(ordem);
      }}
      className="inline-flex items-center text-[11px] font-medium whitespace-nowrap hover:text-foreground"
    >
      {rotulo}
      <IconeDaOrdem ativa={ordenacao.ordem === ordem} direcao={ordenacao.direcao} />
    </button>
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative overflow-x-auto rounded-lg border border-border/70 bg-card">
        <table className="w-full border-separate border-spacing-0 text-[12px]">
          <thead className="bg-muted/60">
            <tr className="text-left text-muted-foreground">
              <th {...fixa(0, CABECALHO_FIXO)}>NF</th>
              <th {...fixa(1, CABECALHO_FIXO)}>CT-e</th>
              <th {...fixa(2, `whitespace-nowrap ${CABECALHO_FIXO}`)}>
                {botaoDeOrdem("Atraso", "atraso")}
              </th>
              <th {...fixa(3, CABECALHO_FIXO)}>Cliente Destino</th>
              <th className={TH}>Origem</th>
              <th className={TH}>Destino</th>
              <th className={TH}>Cidade Destino</th>
              <th className={TH}>Setor</th>
              <th className={TH}>Cód Ocorr.</th>
              <th className={TH}>Tipo Ocorrência</th>
              <th className={TH}>Última Ocorrência</th>
              <th className={TH}>Placa</th>
              <th className={TH}>{botaoDeOrdem("Emissão", "emissao")}</th>
              <th className={TH}>{botaoDeOrdem("Prev. Entrega", "prev")}</th>
              <th className={TH}>{botaoDeOrdem("Entrega Realizada", "entrega")}</th>
              <th className={TH}>Pagador</th>
              <th className={TH}>Expedidor</th>
              <th className={TH}>Remetente</th>
              <th className={TH}>Documento</th>
              <th className={`${TH} text-right`}>Peso Real</th>
              <th className={`${TH} text-right`}>Valor Frete</th>
              <th className={`${TH} text-right`}>Qtd Vol.</th>
              <th className={TH}>Localização</th>
              <th className={TH}>1º Manifesto</th>
              <th className={TH}>Últ. Manifesto</th>
              <th className={`${TH} text-right`}>Valor Mercadoria</th>
              <th className={`${TH} text-center`}>SSW</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <Linha key={l.id} l={l} saiuComPrazoVencido={saiuComPrazoVencido} />
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={COLUNAS} className="px-4 py-10 text-center text-muted-foreground">
                  Nenhum CTRC encontrado com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}

function Linha({ l, saiuComPrazoVencido }: { l: LinhaLista; saiuComPrazoVencido: boolean }) {
  const nf = l.numeroNf !== null ? String(l.numeroNf) : "—";
  const ssw = linkDoSsw(l.sigla, l.numero, l.dataEmissao);
  const temTde = l.tde !== null && l.tde > 0;
  return (
    <tr className="border-t border-border/40 odd:bg-background even:bg-muted/20 hover:bg-brand/[0.04]">
      <td {...fixa(0, "px-2 py-1.5 font-mono font-semibold")}>
        <Link
          to="/ctrc/$numero"
          params={{ numero: l.numero }}
          search={{ sigla: l.sigla }}
          className="text-brand hover:underline"
          title="Abrir detalhes do CTRC"
        >
          {nf}
        </Link>
      </td>
      <td {...fixa(1, "px-2 py-1.5 font-mono text-muted-foreground")}>{l.numero}</td>
      <td {...fixa(2, TD)}>
        <SeloDeAtraso atraso={l.atrasoDias} entregue={l.dataEntrega !== null} />
      </td>
      <td
        {...fixa(3, "max-w-[220px] truncate px-2 py-1.5")}
        title={
          temTde
            ? `${l.destinatario ?? ""} · TDE ${formatarMoeda(l.tde)}`
            : (l.destinatario ?? undefined)
        }
      >
        {temTde && (
          <span className="mr-1 rounded border border-amber-500/60 px-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            TDE
          </span>
        )}
        {nz(l.destinatario)}
      </td>
      <td className={`${TD} font-mono`}>{l.sigla}</td>
      <td className={`${TD} font-mono`}>{nz(l.unidadeDestino)}</td>
      <td className={TD}>{nz(l.cidadeDestino)}</td>
      <td className={`${TD} font-mono`}>{nz(l.setor ?? l.setorDestino)}</td>
      <td className={`${TD} font-mono`}>{l.codigo !== null ? `#${l.codigo}` : "—"}</td>
      <td className={`${TD} max-w-[240px] truncate`} title={l.descricao ?? undefined}>
        {nz(l.descricao)}
      </td>
      <td className={TD}>{formatarDataHora(l.dataOcorrencia)}</td>
      <td className={`${TD} font-mono`}>{nz(l.placa)}</td>
      <td className={TD}>{formatarData(l.dataEmissao)}</td>
      <td className={TD}>
        <div className="flex items-center gap-1.5">
          <span>{formatarData(l.dataPrevista)}</span>
          {saiuComPrazoVencido && l.dataPrevista && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  Saiu com prazo vencido
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[260px] text-[11px] leading-snug">
                A primeira saída para entrega (ocorrência 85) foi depois da previsão de entrega (
                {formatarData(l.dataPrevista)}): a carga saiu para a rua com o prazo já estourado.
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      <td className={TD}>{formatarData(l.dataEntrega)}</td>
      <td className={`${TD} max-w-[180px] truncate`} title={l.pagadorNome ?? undefined}>
        {nz(l.pagadorNome)}
      </td>
      <td
        className={`${TD} max-w-[180px] truncate text-muted-foreground`}
        title={l.parceiroNome ?? undefined}
      >
        {nz(l.parceiroNome)}
      </td>
      <td className={`${TD} max-w-[180px] truncate`} title={l.remetente ?? undefined}>
        {nz(l.remetente)}
      </td>
      <td className={`${TD} text-muted-foreground`}>{nz(l.tipoDocumento)}</td>
      <td className={`${TD} text-right font-mono`}>
        {l.peso !== null ? `${numero(l.peso, 2)} kg` : "—"}
      </td>
      <td className={`${TD} text-right font-mono`}>{formatarMoeda(l.valorFrete)}</td>
      <td className={`${TD} text-right font-mono`}>{numero(l.volumes)}</td>
      <td className={`${TD} max-w-[200px] truncate`} title={l.localizacao ?? undefined}>
        {nz(l.localizacao)}
      </td>
      <td className={`${TD} font-mono`}>{nz(l.primeiroManifesto)}</td>
      <td className={`${TD} font-mono`}>{nz(l.ultimoManifesto)}</td>
      <td className={`${TD} text-right font-mono`}>{formatarMoeda(l.valorMercadoria)}</td>
      <td className={`${TD} text-center`}>
        {ssw ? (
          <a
            href={ssw}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded p-1 text-brand hover:bg-brand/10"
            title="Abrir no SSW"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex cursor-help items-center justify-center rounded p-1 text-muted-foreground/60"
                aria-label="Aguardando SSW"
              >
                <Clock className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-[11px] leading-snug">
              Aguardando SSW. A sigla do CTRC será preenchida pelo relatório 0174 em breve.
            </TooltipContent>
          </Tooltip>
        )}
      </td>
    </tr>
  );
}
