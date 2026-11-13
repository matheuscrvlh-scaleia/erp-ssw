import { type PagadorOpcao } from "@erp/shared/contracts/filters";

import { FiltroMultiplo } from "@/components/common/MultiFilter";
import { agruparPagadoresPorNome, cnpjsDosGrupos, gruposMarcados } from "@/lib/filter-options";

/**
 * "Parceiros agrupados": uma opção por nome (matriz e filiais juntas); marcar o nome marca todos
 * os CNPJs que o usam. O selo conta os nomes. origem: PagadorPicker `agruparPorNome` (sistema atual)
 */
export function SeletorDePagadorAgrupado({
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
  const grupos = agruparPagadoresPorNome(opcoes ?? []);
  return (
    <FiltroMultiplo
      rotulo={rotulo}
      textoVazio="todos"
      opcoes={
        opcoes &&
        grupos.map((g) => ({
          valor: g.valor,
          rotulo: g.cnpjFormatado ? `${g.nome} · ${g.cnpjFormatado}` : g.nome,
          detalhe:
            g.ids.length > 1 ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {g.ids.length} CNPJs com este nome
              </span>
            ) : undefined,
        }))
      }
      selecionados={gruposMarcados(grupos, selecionados)}
      aoMudar={(valores) => {
        aoMudar(cnpjsDosGrupos(grupos, selecionados, valores));
      }}
      resumo={(s) => String(s.length)}
      busca
      larguraClasse="w-80"
    />
  );
}
