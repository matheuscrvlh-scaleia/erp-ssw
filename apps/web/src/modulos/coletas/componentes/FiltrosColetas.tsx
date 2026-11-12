import { Alternador } from "@/componentes/comum/Alternador";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  etiquetasQueLimpam,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { temFiltro } from "@/hooks/filtros-na-url";

import { ATALHOS_DE_COLETAS, type BuscaColetas, etiquetasDaBusca } from "../busca";

const OPCOES_DE_TIPO = [
  { valor: "", rotulo: "Normal e reversa" },
  { valor: "NORMAL", rotulo: "Só normal" },
  { valor: "REVERSA", rotulo: "Só reversa" },
] as const satisfies readonly { valor: BuscaColetas["tipo"]; rotulo: string }[];

export function FiltrosColetas({
  busca,
  ativos,
  unidades,
  aoMudar: mudar,
  aoLimpar,
}: {
  busca: BuscaColetas;
  /** Campos da busca fora do padrão (de `useFiltrosNaUrl`). */
  ativos: readonly string[];
  unidades: readonly string[];
  aoMudar: (m: Partial<BuscaColetas>) => void;
  aoLimpar: () => void;
}) {
  return (
    <>
      <FiltrosAvancados ativos={temFiltro(ativos, busca.periodo)} aoLimpar={aoLimpar}>
        <FiltroPeriodo
          periodo={busca.periodo}
          de={busca.de}
          ate={busca.ate}
          atalhos={ATALHOS_DE_COLETAS}
          padrao="30d"
          rotulo="Cadastro"
          aoMudar={mudar}
        />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          por data de cadastro
          <InfoTip texto="O período filtra pela data em que a coleta foi cadastrada no SSW, a mesma do 'período de cadastramento' da opção 050." />
        </span>
        {unidades.length > 1 && (
          <FiltroMultiplo
            rotulo="Unidade"
            opcoes={unidades.map((u) => ({ valor: u }))}
            selecionados={busca.unidades}
            busca={false}
            monoespacado
            aoMudar={(selecionadas) => {
              mudar({ unidades: selecionadas });
            }}
          />
        )}
        <Alternador
          rotulo="Tipo de coleta"
          opcoes={OPCOES_DE_TIPO}
          valor={busca.tipo}
          aoMudar={(tipo) => {
            mudar({ tipo });
          }}
        />
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetasQueLimpam(etiquetasDaBusca(busca), mudar)} />
    </>
  );
}
