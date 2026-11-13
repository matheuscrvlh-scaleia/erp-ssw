import { type PagadorOpcao } from "@erp/shared/contracts/filters";

import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/components/common/AdvancedFilters";
import { SeletorDeFilial } from "@/components/common/BranchSelector";
import { SeletorDePagador } from "@/components/common/PayerSelector";
import { SeletorDeTipoDocumentoDoPeriodo } from "@/components/common/PeriodDocumentTypeSelector";
import { FiltroPeriodo } from "@/components/common/PeriodFilter";
import { FiltroTexto } from "@/components/common/TextFilter";
import { Alternador } from "@/components/common/Toggle";
import {
  consultasDoSeletorDeFilial,
  consultaTiposDocumento,
  consultaTiposNoPeriodo,
  type ContextoDosFiltros,
  sugestoesDoCampo,
} from "@/modules/filters/api";

import { type FiltrosDoRanking } from "../search";
import { ROTULO_DA_BASE } from "../texts";
import { SeletorDePagadorAgrupado } from "./GroupedPayerSelector";

const ATALHOS = ["hoje", "7d", "30d", "mes"] as const;

/** Barra de filtros do ranking (vale para as duas abas) e as etiquetas do "Filtrando por". */
export function FiltrosRanking({
  filtros: f,
  periodo,
  pagadores,
  contexto,
  etiquetas,
}: {
  filtros: FiltrosDoRanking;
  periodo: { inicio: string; fim: string };
  /** Opções de Parceiros: pagadores com CT-e no período e nas unidades escolhidas. */
  pagadores: readonly PagadorOpcao[] | undefined;
  contexto: ContextoDosFiltros;
  etiquetas: readonly EtiquetaFiltroOpcional[];
}) {
  const { base, filiais, remetente, destino, tipos } = f;
  return (
    <>
      <FiltrosAvancados ativos={f.ativos} aoLimpar={f.limpar}>
        <FiltroPeriodo
          periodo={f.rapido}
          de={f.de}
          ate={f.ate}
          atalhos={ATALHOS}
          padrao="30d"
          rotulo={base === "emissao" ? "Emissão" : "Previsão"}
          aoMudar={f.mudarPeriodo}
        />
        <Alternador
          rotulo="Data usada no período"
          valor={base}
          aoMudar={f.setBase}
          opcoes={[
            {
              valor: "emissao",
              rotulo: "Emissão",
              dica: `Recorta o período pela ${ROTULO_DA_BASE.emissao} do CT-e`,
            },
            {
              valor: "prevista",
              rotulo: "Previsão de entrega",
              dica: `Recorta o período pela ${ROTULO_DA_BASE.prevista} do CT-e`,
            },
          ]}
        />
        <SeletorDeFilial
          selecionadas={filiais}
          consultas={consultasDoSeletorDeFilial(contexto)}
          aoMudar={f.setFiliais}
        />
        <SeletorDePagador
          rotulo="Parceiros"
          opcoes={pagadores}
          selecionados={f.parceirosCnpj}
          aoMudar={f.setParceirosCnpj}
        />
        <SeletorDePagadorAgrupado
          rotulo="Parceiros agrupados"
          opcoes={pagadores}
          selecionados={f.parceirosAgrupados}
          aoMudar={f.setParceirosAgrupados}
        />
        <FiltroTexto
          rotulo="Remetente"
          valor={remetente}
          sugestoes={sugestoesDoCampo(contexto, "remetente")}
          aoMudar={f.setRemetente}
        />
        <FiltroTexto
          rotulo="Destino"
          valor={destino}
          sugestoes={sugestoesDoCampo(contexto, "cidade_destino")}
          aoMudar={f.setDestino}
        />
        <SeletorDeTipoDocumentoDoPeriodo
          consultaTipos={consultaTiposDocumento}
          selecionados={tipos}
          consultaNoPeriodo={consultaTiposNoPeriodo({
            inicio: periodo.inicio,
            fim: periodo.fim,
            campoData: base,
          })}
          aoMudar={f.setTipos}
        />
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
