import { type LinhaBonificacao } from "@erp/dominio/bonificacao-entrega";
import { NIVEIS_DE_BONIFICACAO } from "@erp/shared/contratos/bonificacao-entrega";
import { formatarDiaMes, formatarMoeda } from "@erp/shared/formatacao";

import {
  CLASSE_CABECALHO,
  CLASSE_LINHA,
  CLASSE_TABELA,
  CLASSE_TD,
  CLASSE_TH,
} from "@/componentes/comum/classes-de-tabela";
import { EstadoVazio } from "@/componentes/comum/EstadoVazio";
import { cn } from "@/lib/utils";

/** Visão "Por dia": veículos, pessoas, NFs, níveis e custo de cada dia. */
export function TabelaPorDia({
  porDia,
}: {
  porDia: readonly (readonly [string, readonly LinhaBonificacao[]])[];
}) {
  return (
    <table className={CLASSE_TABELA}>
      <thead>
        <tr className={CLASSE_CABECALHO}>
          <th scope="col" className={CLASSE_TH}>
            Dia
          </th>
          {[
            "Veículos",
            "Pessoas",
            "NFs entregues",
            "Turbo",
            "Acelerado",
            "Em rota",
            "Sem bônus",
            "Custo do dia",
          ].map((t) => (
            <th key={t} scope="col" className={cn(CLASSE_TH, "text-right")}>
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {porDia.map(([dia, ls]) => (
          <tr key={dia} className={CLASSE_LINHA}>
            <td className={cn(CLASSE_TD, "font-semibold")}>{formatarDiaMes(dia)}</td>
            <td className={cn(CLASSE_TD, "text-right")}>
              {new Set(ls.map((l) => l.romaneio)).size}
            </td>
            <td className={cn(CLASSE_TD, "text-right")}>{ls.length}</td>
            <td className={cn(CLASSE_TD, "text-right")}>
              {ls.reduce((a, l) => a + l.nfsEntregues, 0)}
            </td>
            {NIVEIS_DE_BONIFICACAO.map((n) => (
              <td key={n} className={cn(CLASSE_TD, "text-right")}>
                {ls.filter((l) => l.nivel === n).length}
              </td>
            ))}
            <td className={cn(CLASSE_TD, "text-right font-semibold")}>
              {formatarMoeda(ls.reduce((a, l) => a + Math.round(l.bonus * 10_000), 0) / 10_000)}
            </td>
          </tr>
        ))}
        {porDia.length === 0 && (
          <tr>
            <td colSpan={9}>
              <EstadoVazio mensagem="Nenhum lançamento no recorte." />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
