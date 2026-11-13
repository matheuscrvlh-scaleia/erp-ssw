/** Grupo da lista agrupada: cabeçalho com subtotal (abre e fecha) e as linhas. */
import { type LinhaLista } from "@erp/shared/contracts/manifest";
import { formatarInteiro, formatarMoeda, formatarPeso } from "@erp/shared/formatting";
import { ChevronDown, ChevronRight } from "lucide-react";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

import { CLASSE_NUMERO, COLUNAS_ANTES_DO_PESO, COLUNAS_DA_TABELA } from "../texts";

export function GrupoDaLista({
  rotulo,
  linhas,
  subtotal,
  children,
}: {
  rotulo: string;
  linhas: readonly LinhaLista[];
  subtotal: { ctes: number; peso: number; volumes: number; frete: number } | null;
  children: (l: LinhaLista) => ReactNode;
}) {
  const [aberto, setAberto] = useState(true);
  const soma = subtotal ?? {
    ctes: linhas.length,
    peso: linhas.reduce((s, l) => s + (l.peso ?? 0), 0),
    volumes: linhas.reduce((s, l) => s + (l.volumes ?? 0), 0),
    frete: linhas.reduce((s, l) => s + (l.valorFrete ?? 0), 0),
  };
  const Seta = aberto ? ChevronDown : ChevronRight;
  return (
    <>
      <tr className="border-y border-border bg-muted/60">
        <td colSpan={COLUNAS_ANTES_DO_PESO} className="sticky left-0 z-[5] px-4 py-2">
          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => {
              setAberto((a) => !a);
            }}
            className="inline-flex items-center gap-1.5 font-semibold"
          >
            <Seta className="h-4 w-4" aria-hidden />
            {rotulo}
            <span className="ml-2 text-[12.5px] font-normal text-muted-foreground">
              {formatarInteiro(soma.ctes)} notas
            </span>
          </button>
        </td>
        <td className={cn(CLASSE_NUMERO, "py-2 font-semibold")}>
          {formatarPeso(soma.peso, { fixas: true })}
        </td>
        <td className={cn(CLASSE_NUMERO, "py-2 font-semibold")}>{formatarInteiro(soma.volumes)}</td>
        <td className={cn(CLASSE_NUMERO, "py-2 font-semibold")}>{formatarMoeda(soma.frete)}</td>
        <td colSpan={COLUNAS_DA_TABELA - COLUNAS_ANTES_DO_PESO - 3} />
      </tr>
      {aberto && linhas.map((l) => children(l))}
    </>
  );
}
