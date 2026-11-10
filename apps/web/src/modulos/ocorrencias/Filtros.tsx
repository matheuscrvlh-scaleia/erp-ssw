import { RESPONSAVEIS_DO_FILTRO, SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/ocorrencias";

import { FiltroMultiplo, type OpcaoFiltro } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import { FiltrosAvancados } from "@/componentes/comum/FiltrosAvancados";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { CampoDeTexto, classeDoSegmento, listaDoTexto } from "@/modulos/compartilhado/CampoDeTexto";

import { type BuscaOcorrencias } from "./busca";
import { rotulosDoResponsavel } from "./rotulos";

export interface OpcoesDosFiltros {
  parceiros: readonly OpcaoFiltro[] | undefined;
  codigos: readonly OpcaoFiltro[] | undefined;
  conferentes: readonly OpcaoFiltro[] | undefined;
}

export function BarraDeFiltros({
  busca,
  opcoes,
  codigosAcompanhados,
  nomeCurto,
  filtrando,
  mudar,
  aoLimpar,
}: {
  busca: BuscaOcorrencias;
  opcoes: OpcoesDosFiltros;
  codigosAcompanhados: number | null;
  nomeCurto: string;
  filtrando: boolean;
  mudar: (m: Partial<BuscaOcorrencias>) => void;
  aoLimpar: () => void;
}) {
  const rotulos = rotulosDoResponsavel(nomeCurto);
  const porEmissao = busca.campoData === "emissao";
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
      <CampoDeTexto
        rotulo="CTRC"
        placeholder="CTRC..."
        valor={busca.ctrc}
        aoConfirmar={(ctrc) => {
          mudar({ ctrc });
        }}
      />
      <CampoDeTexto
        rotulo="Nota fiscal"
        placeholder="Nota fiscal..."
        valor={busca.nf}
        aoConfirmar={(nf) => {
          mudar({ nf });
        }}
      />
      <FiltroMultiplo
        rotulo="Parceiros"
        opcoes={opcoes.parceiros}
        selecionados={busca.parceiros}
        aoMudar={(parceiros) => {
          mudar({ parceiros });
        }}
      />
      {/* As opções de unidade, as sugestões e os tipos vêm dos filtros compartilhados da
          Listagem (outra entrega); até lá, digitados. */}
      <CampoDeTexto
        rotulo="Unidade responsável"
        placeholder="Unidade (RIO, SPO)"
        valor={busca.filiais.join(", ")}
        aoConfirmar={(texto) => {
          mudar({ filiais: listaDoTexto(texto) });
        }}
      />
      <FiltroTexto
        rotulo="Remetente"
        valor={busca.remetente}
        aoMudar={(remetente) => {
          mudar({ remetente });
        }}
      />
      <FiltroTexto
        rotulo="Destino"
        valor={busca.destino}
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
      <CampoDeTexto
        rotulo="Tipo documento"
        placeholder="Tipo documento"
        valor={busca.tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t)).join(", ")}
        aoConfirmar={(texto) => {
          mudar({
            tipos: listaDoTexto(texto).map((t) => (t === "SEM TIPO" ? SEM_TIPO_DOCUMENTO : t)),
          });
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
