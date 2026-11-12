import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosFiltros as c } from "@erp/shared/contratos/filtros";
import { type QueryKey, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useState } from "react";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { siglasDoSeletor } from "@/lib/opcoes-de-filtro";

type Opcoes = SaidaDe<typeof c.opcoes>;
type Proprias = SaidaDe<typeof c.filiaisProprias>;

/**
 * "Unidade responsável": unidades do período, consultadas só com o seletor aberto. As consultas
 * vêm de quem usa (`consultasDoSeletorDeFilial` do módulo filtros).
 * origem: FiltrosAvancados.tsx (sistema atual)
 */
export function SeletorDeFilial<ChaveOpcoes extends QueryKey, ChaveProprias extends QueryKey>({
  selecionadas,
  aoMudar,
  consultas,
}: {
  selecionadas: readonly string[];
  aoMudar: (siglas: string[]) => void;
  consultas: {
    opcoes: UseQueryOptions<Opcoes, Error, Opcoes, ChaveOpcoes>;
    proprias: UseQueryOptions<Proprias, Error, Proprias, ChaveProprias>;
  };
}) {
  const [aberto, setAberto] = useState(false);
  const opcoes = useQuery({ ...consultas.opcoes, enabled: aberto });
  const proprias = useQuery({ ...consultas.proprias, enabled: aberto });
  const siglas = opcoes.data
    ? siglasDoSeletor(opcoes.data.filiais, selecionadas, proprias.data ?? [])
    : undefined;
  return (
    <span className="inline-flex items-center gap-1">
      <FiltroMultiplo
        rotulo="Unidade responsável"
        opcoes={siglas?.map((s) => ({ valor: s }))}
        selecionados={selecionadas}
        aoMudar={aoMudar}
        aoAbrir={setAberto}
        resumo={(s) => String(s.length)}
        larguraClasse="w-48"
        monoespacado
      />
      <InfoTip texto="Unidade responsável pelo CT-e: usa a unidade de destino; na falta dela, a unidade atual; e por último a filial emissora." />
    </span>
  );
}
