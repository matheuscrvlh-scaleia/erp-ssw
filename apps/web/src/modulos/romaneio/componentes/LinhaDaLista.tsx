/** Uma linha da lista da aba Total. */
import { alertasDaLinha, atrasoDaLinha, type LimitesDeCarga } from "@erp/dominio/romaneio/linha";
import { type LinhaLista } from "@erp/shared/contratos/romaneio";
import {
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarMoeda,
  formatarPeso,
} from "@erp/shared/formatacao";

import { Checkbox } from "@/componentes/ui/checkbox";
import { cn } from "@/lib/utils";

import { situacaoDe } from "../regras";
import { cidadeUf, CLASSE_CODIGO, CLASSE_NUMERO, ROTULO_FONTE } from "../textos";
import { Atraso } from "./Atraso";
import { LinhaDoTempo } from "./LinhaDoTempo";
import { SeloDeStatus } from "./SeloDeStatus";
import { SeloDoAlerta } from "./SeloDoAlerta";
import { propsDaLinha } from "./TabelaPropria";

export function LinhaDaLista({
  linha: l,
  hoje,
  limites,
  aoAbrir,
  marcada,
  aoMarcar,
}: {
  linha: LinhaLista;
  hoje: string;
  limites: LimitesDeCarga;
  aoAbrir: () => void;
  marcada: boolean;
  aoMarcar: () => void;
}) {
  const situacao = situacaoDe(l);
  const atraso = atrasoDaLinha(situacao, hoje);
  const alertas = alertasDaLinha(situacao, atraso.dias, limites);
  const atrasada = atraso.dias > 0;
  const o = l.ultimaOcorrencia;
  const fundo = atrasada ? "bg-status-bad-bg" : "bg-card";
  return (
    <tr
      {...propsDaLinha(
        aoAbrir,
        cn("group", atrasada && "bg-status-bad-bg text-status-bad-fg hover:bg-status-bad-bg/70"),
      )}
    >
      <td
        className={cn(
          "sticky left-0 z-[5] px-4 py-2.5 whitespace-nowrap",
          fundo,
          !atrasada && "group-hover:bg-muted",
        )}
      >
        {/* A caixa de seleção não abre o CTRC. */}
        <span
          className="mr-2 inline-flex align-middle"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Checkbox
            checked={marcada}
            onCheckedChange={aoMarcar}
            aria-label={`Marcar NF ${l.numeroNf ?? l.numero} para exportação`}
          />
        </span>
        {l.numeroNf !== null ? (
          <span className="font-mono text-[12px] font-semibold text-brand">{l.numeroNf}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className={cn(CLASSE_CODIGO, !atrasada && "text-muted-foreground")}>{l.numero}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <SeloDeStatus linha={l} />
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">{formatarData(l.dataEmissao)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">{formatarData(l.dataEmbarque)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">{formatarData(l.dataPrevista)}</td>
      <td className="max-w-[180px] truncate px-4 py-2.5">{l.parceiroNome ?? "—"}</td>
      <td className={cn(CLASSE_CODIGO, !atrasada && "text-muted-foreground")}>{l.filial ?? "—"}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {cidadeUf(l.unidadeCidade, l.unidadeUf) ?? "—"}
      </td>
      <td className={cn(CLASSE_CODIGO, !atrasada && "text-muted-foreground")}>
        {l.unidadeAtual ?? "—"}
      </td>
      <td className={CLASSE_CODIGO}>{l.placa ?? "—"}</td>
      <td className="max-w-[160px] truncate px-4 py-2.5">{l.motorista ?? "—"}</td>
      <td className="max-w-[200px] truncate px-4 py-2.5">{l.remetente ?? "—"}</td>
      <td className="max-w-[200px] truncate px-4 py-2.5" title={l.destinatario ?? undefined}>
        {l.destinatario ?? "—"}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {cidadeUf(l.cidadeDestino, l.ufDestino) ?? "—"}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">{l.setor ?? "—"}</td>
      <td className="max-w-[160px] truncate px-4 py-2.5" title={l.endereco ?? undefined}>
        {l.bairro ?? "—"}
      </td>
      <td className={CLASSE_NUMERO}>{formatarMoeda(l.valorMercadoria)}</td>
      <td className={CLASSE_NUMERO}>{formatarPeso(l.peso, { fixas: true })}</td>
      <td className={CLASSE_NUMERO}>{l.volumes === null ? "—" : formatarInteiro(l.volumes)}</td>
      <td className={CLASSE_NUMERO}>{formatarMoeda(l.valorFrete)}</td>
      <td
        className={cn("px-4 py-2.5", !atrasada && "text-muted-foreground")}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center gap-1">
          {o?.descricao ? (
            <span
              title={[
                `Código ${o.codigo}`,
                o.dataHora ? formatarDataHora(o.dataHora) : null,
                o.fonte ? `Fonte: ${ROTULO_FONTE[o.fonte]}` : null,
              ]
                .filter((t) => t !== null)
                .join(" · ")}
            >
              {o.descricao}
            </span>
          ) : (
            (l.statusAtual ?? "—")
          )}
          <LinhaDoTempo sigla={l.sigla} numero={l.numero} />
        </div>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <Atraso linha={l} dias={atraso.dias} fonte={atraso.fonte} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {alertas.map((a) => (
            <SeloDoAlerta key={a} alerta={a} fonte={atraso.fonte} tde={l.tde} />
          ))}
        </div>
      </td>
    </tr>
  );
}
