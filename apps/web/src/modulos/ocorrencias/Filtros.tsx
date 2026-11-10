import { type PagadorOpcao } from "@erp/shared/contratos/filtros";
import { RESPONSAVEIS_DO_FILTRO } from "@erp/shared/contratos/ocorrencias";

import { FiltroMultiplo, type OpcaoFiltro } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { classeDoSegmento } from "@/modulos/compartilhado/segmento";
import {
  BuscaDocumento,
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDeTexto,
  SeletorDeTipoDocumento,
} from "@/modulos/filtros/componentes";

import { type BuscaOcorrencias } from "./busca";
import { rotulosDoResponsavel } from "./rotulos";

interface OpcoesDosFiltros {
  parceiros: readonly PagadorOpcao[] | undefined;
  codigos: readonly OpcaoFiltro[] | undefined;
  conferentes: readonly OpcaoFiltro[] | undefined;
}

export function BarraDeFiltros({
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
      <div
        role="group"
        aria-label="Visualizar ocorrências por"
        className="flex rounded-md border border-border/70 p-0.5"
      >
        {(["emissao", "prevista"] as const).map((campoData) => (
          <button
            key={campoData}
            type="button"
            aria-pressed={busca.campoData === campoData}
            onClick={() => {
              mudar({ campoData });
            }}
            className={classeDoSegmento(busca.campoData === campoData)}
          >
            {campoData === "emissao" ? "Por emissão" : "Por previsão"}
          </button>
        ))}
      </div>
      <FiltroPeriodo
        periodo={busca.periodo}
        de={busca.de}
        ate={busca.ate}
        rotulo={porEmissao ? "Emissão" : "Previsão"}
        aoMudar={mudar}
      />
      <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
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
        <span className="flex items-center gap-1 text-[12px] text-muted-foreground">
          recorte: {codigosAcompanhados} códigos de pendência
          <InfoTip texto="Esta tela considera apenas os códigos de pendência marcados como acompanhados no cadastro de códigos, menos os que a empresa tirou da tela na configuração. É um recorte independente da classificação penaliza/responsável." />
        </span>
      )}
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
        contexto={contexto}
        aoMudar={(filiais) => {
          mudar({ filiais });
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
      <SeletorDeTipoDocumento
        selecionados={busca.tipos}
        escopo={{ ...periodo, campoData: busca.campoData }}
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
    </FiltrosAvancados>
  );
}
