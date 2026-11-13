import { type PagadorOpcao } from "@erp/shared/contracts/filters";

import { FiltrosAvancados } from "@/components/common/AdvancedFilters";
import { SeletorDeFilial } from "@/components/common/BranchSelector";
import { BuscaDocumento } from "@/components/common/DocumentSearch";
import { SeletorDeTipoDocumento } from "@/components/common/DocumentTypeSelector";
import { InfoTip } from "@/components/common/InfoTip";
import { SeletorDePagador } from "@/components/common/PayerSelector";
import { FiltroPeriodo } from "@/components/common/PeriodFilter";
import { FiltroTexto } from "@/components/common/TextFilter";
import {
  consultasDoSeletorDeFilial,
  consultaTiposDocumento,
  type ContextoDosFiltros,
  sugestoesDoCampo,
} from "@/modules/filters/api";

import { type BuscaComprovantes } from "../search";

export function FiltrosComprovantes({
  busca,
  periodo,
  pagadores,
  tiposContagem,
  filtrando,
  mudar,
  aoLimpar,
}: {
  busca: BuscaComprovantes;
  periodo: { inicio: string; fim: string };
  pagadores: PagadorOpcao[] | undefined;
  tiposContagem: { tipo: string; qtd: number }[] | undefined;
  filtrando: boolean;
  mudar: (m: Partial<BuscaComprovantes>) => void;
  aoLimpar: () => void;
}) {
  const contexto: ContextoDosFiltros = {
    inicio: periodo.inicio,
    fim: periodo.fim,
    parceiros: busca.pagadores,
    remetente: busca.remetente,
    destino: busca.destino,
  };
  return (
    <FiltrosAvancados ativos={filtrando} aoLimpar={aoLimpar}>
      <FiltroPeriodo
        periodo={busca.periodo}
        de={busca.de}
        ate={busca.ate}
        rotulo="Entrega"
        aoMudar={mudar}
      />
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        por data de entrega
        <InfoTip texto="O período filtra pelo dia da entrega concluída em Brasília (data de entrega realizada ou, na falta dela, a data da ocorrência de conclusão)." />
      </span>
      <SeletorDeFilial
        selecionadas={busca.filiais}
        consultas={consultasDoSeletorDeFilial(contexto)}
        aoMudar={(filiais) => {
          mudar({ filiais });
        }}
      />
      <SeletorDePagador
        rotulo="Pagador"
        opcoes={pagadores}
        selecionados={busca.pagadores}
        aoMudar={(pagadores) => {
          mudar({ pagadores });
        }}
      />
      <FiltroTexto
        rotulo="Remetente"
        valor={busca.remetente}
        sugestoes={sugestoesDoCampo(contexto, "remetente")}
        aoMudar={(remetente) => {
          mudar({ remetente });
        }}
      />
      <FiltroTexto
        rotulo="Destino"
        valor={busca.destino}
        sugestoes={sugestoesDoCampo(contexto, "cidade_destino")}
        aoMudar={(destino) => {
          mudar({ destino });
        }}
      />
      <SeletorDeTipoDocumento
        consultaTipos={consultaTiposDocumento}
        selecionados={busca.tipos}
        contagens={tiposContagem}
        aoMudar={(tipos) => {
          mudar({ tipos });
        }}
      />
      <BuscaDocumento
        valor={busca.ctrc}
        placeholder="CTRC..."
        className="w-[150px]"
        aoMudar={(ctrc) => {
          mudar({ ctrc });
        }}
      />
      <BuscaDocumento
        valor={busca.nf}
        placeholder="Nota fiscal..."
        className="w-[150px]"
        aoMudar={(nf) => {
          mudar({ nf });
        }}
      />
    </FiltrosAvancados>
  );
}
