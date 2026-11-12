import { type PagadorOpcao } from "@erp/shared/contratos/filtros";

import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import {
  BuscaDocumento,
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDeTexto,
  SeletorDeTipoDocumento,
} from "@/modulos/filtros/componentes";

import { type BuscaComprovantes } from "../busca";

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
        contexto={contexto}
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
      <SeletorDeTexto
        rotulo="Remetente"
        campo="remetente"
        valor={busca.remetente}
        contexto={contexto}
        aoMudar={(remetente) => {
          mudar({ remetente });
        }}
      />
      <SeletorDeTexto
        rotulo="Destino"
        campo="cidade_destino"
        valor={busca.destino}
        contexto={contexto}
        aoMudar={(destino) => {
          mudar({ destino });
        }}
      />
      <SeletorDeTipoDocumento
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
