import { type PagadorOpcao } from "@erp/shared/contratos/filtros";
import { RESPONSAVEIS_DO_FILTRO } from "@erp/shared/contratos/ocorrencias";

import { Alternador } from "@/componentes/comum/Alternador";
import { BuscaDocumento } from "@/componentes/comum/BuscaDocumento";
import { FiltroMultiplo, type OpcaoFiltro } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { SeletorDeFilial } from "@/componentes/comum/SeletorDeFilial";
import { SeletorDePagador } from "@/componentes/comum/SeletorDePagador";
import { SeletorDeTipoDocumentoDoPeriodo } from "@/componentes/comum/SeletorDeTipoDocumentoDoPeriodo";
import {
  consultasDoSeletorDeFilial,
  consultaTiposDocumento,
  consultaTiposNoPeriodo,
  type ContextoDosFiltros,
  sugestoesDoCampo,
} from "@/modulos/filtros/api";

import { type BuscaOcorrencias } from "../busca";
import { rotulosDoResponsavel } from "../textos";

const OPCOES_DE_DATA = [
  { valor: "emissao", rotulo: "Por emissão" },
  { valor: "prevista", rotulo: "Por previsão" },
] as const;

interface OpcoesDosFiltros {
  parceiros: readonly PagadorOpcao[] | undefined;
  codigos: readonly OpcaoFiltro[] | undefined;
  conferentes: readonly OpcaoFiltro[] | undefined;
}

export function FiltrosOcorrencias({
  busca,
  periodo,
  opcoes,
  codigosAcompanhados,
  nomeCurto,
  filtrando,
  mudar,
  aoLimpar,
}: {
  busca: BuscaOcorrencias;
  periodo: { inicio: string; fim: string };
  opcoes: OpcoesDosFiltros;
  codigosAcompanhados: number | null;
  nomeCurto: string;
  filtrando: boolean;
  mudar: (m: Partial<BuscaOcorrencias>) => void;
  aoLimpar: () => void;
}) {
  const rotulos = rotulosDoResponsavel(nomeCurto);
  const porEmissao = busca.campoData === "emissao";
  const contexto: ContextoDosFiltros = {
    ...periodo,
    parceiros: busca.parceiros,
    remetente: busca.remetente,
    destino: busca.destino,
  };
  return (
    <FiltrosAvancados ativos={filtrando} aoLimpar={aoLimpar}>
      <Alternador
        rotulo="Visualizar ocorrências por"
        opcoes={OPCOES_DE_DATA}
        valor={busca.campoData}
        aoMudar={(campoData) => {
          mudar({ campoData });
        }}
      />
      <FiltroPeriodo
        periodo={busca.periodo}
        de={busca.de}
        ate={busca.ate}
        rotulo={porEmissao ? "Emissão" : "Previsão"}
        aoMudar={mudar}
      />
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {porEmissao ? "por data de emissão" : "por previsão de entrega"}
        <InfoTip
          texto={
            porEmissao
              ? "O período seleciona os CT-e pela data de emissão e exibe suas ocorrências acompanhadas."
              : "O período seleciona os CT-e pela previsão de entrega e exibe suas ocorrências acompanhadas. CT-e sem previsão ficam fora desta visão."
          }
        />
      </span>
      {codigosAcompanhados !== null && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          recorte: {codigosAcompanhados} códigos de pendência
          <InfoTip texto="Esta tela considera apenas os códigos de pendência marcados como acompanhados no cadastro de códigos, menos os que a empresa tirou da tela na configuração. É um recorte independente da classificação penaliza/responsável." />
        </span>
      )}
      <SeletorDePagador
        rotulo="Parceiros"
        opcoes={opcoes.parceiros}
        selecionados={busca.parceiros}
        aoMudar={(parceiros) => {
          mudar({ parceiros });
        }}
      />
      <SeletorDeFilial
        selecionadas={busca.filiais}
        consultas={consultasDoSeletorDeFilial(contexto)}
        aoMudar={(filiais) => {
          mudar({ filiais });
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
      <FiltroMultiplo
        rotulo="Códigos"
        opcoes={opcoes.codigos}
        selecionados={busca.codigos.map(String)}
        aoMudar={(codigos) => {
          mudar({ codigos: codigos.map(Number) });
        }}
        monoespacado
      />
      <FiltroMultiplo
        rotulo="Responsável"
        opcoes={RESPONSAVEIS_DO_FILTRO.map((r) => ({ valor: r, rotulo: rotulos[r] }))}
        selecionados={busca.responsaveis}
        busca={false}
        aoMudar={(rs) => {
          mudar({ responsaveis: RESPONSAVEIS_DO_FILTRO.filter((r) => rs.includes(r)) });
        }}
      />
      <SeletorDeTipoDocumentoDoPeriodo
        consultaTipos={consultaTiposDocumento}
        selecionados={busca.tipos}
        consultaNoPeriodo={consultaTiposNoPeriodo({ ...periodo, campoData: busca.campoData })}
        aoMudar={(tipos) => {
          mudar({ tipos });
        }}
      />
      <FiltroMultiplo
        rotulo="Conferente"
        opcoes={opcoes.conferentes}
        selecionados={busca.conferentes}
        aoMudar={(conferentes) => {
          mudar({ conferentes });
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
