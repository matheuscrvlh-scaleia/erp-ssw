import { ordenarTiposDocumento } from "@erp/dominio/performance/tela";
import { type SaidaDe } from "@erp/shared/contrato";
import {
  type contratosFiltros as c,
  SEM_TIPO_DOCUMENTO,
  type TipoDocumentoOpcao,
} from "@erp/shared/contratos/filtros";
import { formatarInteiro } from "@erp/shared/formatacao";
import { type QueryKey, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useState } from "react";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";

type Tipos = SaidaDe<typeof c.tiposDocumento>;

/**
 * "Tipo documento": os tipos da base inteira, com quantos CT-e de cada há no período da tela; os
 * sem CT-e no período ficam apagados, no fim. A lista só é buscada com o seletor aberto (a
 * consulta vem de quem usa: `consultaTiposDocumento` do módulo filtros).
 * origem: TipoDocumentoPicker (FiltrosAvancados.tsx, sistema atual)
 */
export function SeletorDeTipoDocumento<Chave extends QueryKey>({
  selecionados,
  aoMudar,
  consultaTipos,
  contagens,
  aoAbrir,
}: {
  selecionados: readonly string[];
  aoMudar: (tipos: string[]) => void;
  consultaTipos: UseQueryOptions<Tipos, Error, Tipos, Chave>;
  /** Quantos CT-e de cada tipo; sem ela (ainda não chegou ou não deu para contar), nenhum fica apagado. */
  contagens?: readonly TipoDocumentoOpcao[] | undefined;
  /** Avisa abrir/fechar (a tela que passa `contagens` pode buscá-las só aberto). */
  aoAbrir?: ((aberto: boolean) => void) | undefined;
}) {
  const [aberto, setAberto] = useState(false);
  const tipos = useQuery({ ...consultaTipos, enabled: aberto });
  return (
    <FiltroMultiplo
      rotulo="Tipo documento"
      textoVazio="todos"
      opcoes={
        tipos.data
          ? ordenarTiposDocumento(tipos.data, contagens).map((t) => ({
              valor: t.tipo,
              rotulo: t.tipo === SEM_TIPO_DOCUMENTO ? "Sem tipo" : t.tipo,
              detalhe: contagens && t.qtd > 0 ? formatarInteiro(t.qtd) : undefined,
              apagada: contagens !== undefined && t.qtd === 0,
            }))
          : undefined
      }
      aoAbrir={(a) => {
        setAberto(a);
        aoAbrir?.(a);
      }}
      selecionados={selecionados}
      aoMudar={aoMudar}
    />
  );
}
