import { type PagadorOpcao } from "@erp/shared/contratos/filtros";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";

/**
 * Parceiros (pagadores do período), com busca por nome ou CNPJ.
 * origem: PagadorPicker.tsx (sistema atual)
 */
export function SeletorDePagador({
  rotulo,
  opcoes,
  selecionados,
  aoMudar,
}: {
  rotulo: string;
  opcoes: readonly PagadorOpcao[] | undefined;
  selecionados: readonly string[];
  aoMudar: (ids: string[]) => void;
}) {
  return (
    <FiltroMultiplo
      rotulo={rotulo}
      textoVazio="todos"
      opcoes={opcoes?.map((o) => ({
        valor: o.id,
        rotulo: `${o.nome} · ${o.cnpjFormatado}`,
      }))}
      selecionados={selecionados}
      aoMudar={aoMudar}
      resumo={(s) => String(s.length)}
      busca
      larguraClasse="w-80"
    />
  );
}
