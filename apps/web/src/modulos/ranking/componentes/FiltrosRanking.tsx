import { type PagadorOpcao } from "@erp/shared/contratos/filtros";

import { Alternador } from "@/componentes/comum/Alternador";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import {
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDePagadorAgrupado,
  SeletorDeTexto,
  SeletorDeTipoDocumento,
} from "@/modulos/filtros/componentes";

import { type FiltrosDoRanking } from "../busca";
import { ROTULO_DA_BASE } from "../textos";

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
        <SeletorDeFilial selecionadas={filiais} contexto={contexto} aoMudar={f.setFiliais} />
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
        <SeletorDeTexto
          rotulo="Remetente"
          campo="remetente"
          valor={remetente}
          contexto={contexto}
          aoMudar={f.setRemetente}
        />
        <SeletorDeTexto
          rotulo="Destino"
          campo="cidade_destino"
          valor={destino}
          contexto={contexto}
          aoMudar={f.setDestino}
        />
        <SeletorDeTipoDocumento
          selecionados={tipos}
          escopo={{ inicio: periodo.inicio, fim: periodo.fim, campoData: base }}
          aoMudar={f.setTipos}
        />
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
