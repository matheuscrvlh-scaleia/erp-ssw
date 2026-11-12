import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosFiltros as c } from "@erp/shared/contratos/filtros";
import { type QueryKey, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useState } from "react";

import { SeletorDeTipoDocumento } from "@/componentes/comum/SeletorDeTipoDocumento";

type Tipos = SaidaDe<typeof c.tiposDocumento>;
type NoPeriodo = SaidaDe<typeof c.tiposDocumentoNoPeriodo>;

/**
 * "Tipo documento" com a contagem do período da tela buscada aqui: as duas listas só são buscadas
 * com o seletor aberto (`consultaTiposDocumento` e `consultaTiposNoPeriodo` do módulo filtros).
 */
export function SeletorDeTipoDocumentoDoPeriodo<
  ChaveTipos extends QueryKey,
  ChaveNoPeriodo extends QueryKey,
>({
  selecionados,
  aoMudar,
  consultaTipos,
  consultaNoPeriodo,
}: {
  selecionados: readonly string[];
  aoMudar: (tipos: string[]) => void;
  consultaTipos: UseQueryOptions<Tipos, Error, Tipos, ChaveTipos>;
  consultaNoPeriodo: UseQueryOptions<NoPeriodo, Error, NoPeriodo, ChaveNoPeriodo>;
}) {
  const [aberto, setAberto] = useState(false);
  const noPeriodo = useQuery({ ...consultaNoPeriodo, enabled: aberto });
  return (
    <SeletorDeTipoDocumento
      selecionados={selecionados}
      aoMudar={aoMudar}
      consultaTipos={consultaTipos}
      contagens={noPeriodo.data ?? undefined}
      aoAbrir={setAberto}
    />
  );
}
