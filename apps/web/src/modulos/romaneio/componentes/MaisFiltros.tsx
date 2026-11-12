import { SEM_TIPO } from "@erp/dominio/romaneio/hoje";
import { type SaidaDe } from "@erp/shared/contrato";
import { type contratosRomaneio, type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { InfoTip } from "@/componentes/comum/InfoTip";

import { type BuscaRomaneio } from "../busca";
import { CampoAdiado } from "./CampoAdiado";
import { FiltroAjudante } from "./FiltroAjudante";
import { FiltroPrevisao } from "./FiltroPrevisao";
import { SeletorDaLista } from "./SeletorDaLista";

/** Filtros dentro de "Mais filtros" (aberto): local atual, remetente, destino, código, tipo, data prevista, placa, motorista/ajudante, status, CTRC e nota fiscal. */
export function MaisFiltros({
  busca: b,
  mudar,
  filtros,
  opcoes,
  opcoesDePlaca,
  opcoesDeMotorista,
  placas,
  motoristas,
  ajudantes,
  codigos,
  descricaoDoCodigo,
}: {
  busca: BuscaRomaneio;
  mudar: (mudanca: Partial<BuscaRomaneio>) => void;
  filtros: FiltrosRomaneio;
  opcoes: SaidaDe<typeof contratosRomaneio.opcoes> | undefined;
  opcoesDePlaca: readonly string[] | undefined;
  opcoesDeMotorista: readonly string[] | undefined;
  placas: string[];
  motoristas: string[];
  ajudantes: string[];
  codigos: string[];
  descricaoDoCodigo: ReadonlyMap<string, string>;
}) {
  return (
    <>
      <span className="basis-full" aria-hidden />
      <FiltroMultiplo
        rotulo="Local. atual"
        opcoes={opcoes?.locaisAtuais.map((valor) => ({ valor }))}
        selecionados={b.unidadeAtual}
        aoMudar={(unidadeAtual) => {
          mudar({ unidadeAtual });
        }}
        monoespacado
      />
      <FiltroTexto
        rotulo="Remetente"
        valor={b.remetente}
        aoMudar={(remetente) => {
          mudar({ remetente });
        }}
      />
      <FiltroTexto
        rotulo="Destino"
        valor={b.destino}
        aoMudar={(destino) => {
          mudar({ destino });
        }}
      />
      <FiltroMultiplo
        rotulo="Código"
        opcoes={opcoes?.codigos.map((c) => ({
          valor: String(c.codigo),
          rotulo: `#${c.codigo}`,
          detalhe: c.descricao,
        }))}
        selecionados={codigos}
        aoMudar={(v) => {
          mudar({ codigos: v, codigo: "" });
        }}
        resumo={(sel) =>
          sel.length === 1 && sel[0] !== undefined
            ? `#${sel[0]} ${descricaoDoCodigo.get(sel[0]) ?? ""}`.trim()
            : `${sel.length} códigos`
        }
        textoVazio="todos"
      />
      <FiltroMultiplo
        rotulo="Tipo documento"
        opcoes={
          opcoes && [
            ...opcoes.tipos.map((valor) => ({ valor })),
            { valor: SEM_TIPO, rotulo: "sem tipo" },
          ]
        }
        selecionados={b.tipos}
        aoMudar={(tipos) => {
          mudar({ tipos });
        }}
        textoVazio="todos"
      />
      <FiltroPrevisao
        valor={b.previsao}
        aoMudar={(previsao) => {
          mudar({ previsao });
        }}
      />
      <InfoTip
        className="self-center"
        texto="Mostra só os CTRC com previsão de entrega neste dia. O prazo vem do SSW; CTRC sem prazo calculado não aparecem."
      />
      <FiltroMultiplo
        rotulo="Placa"
        opcoes={opcoesDePlaca?.map((valor) => ({ valor }))}
        selecionados={placas}
        aoMudar={(v) => {
          mudar({ placas: v, placa: "" });
        }}
        monoespacado
        textoVazio="todas"
      />
      {b.tab !== "ajudantes" && (
        <FiltroMultiplo
          rotulo="Motorista"
          opcoes={opcoesDeMotorista?.map((valor) => ({ valor }))}
          selecionados={motoristas}
          aoMudar={(v) => {
            mudar({ motoristas: v, motorista: "" });
          }}
          textoVazio="todos"
        />
      )}
      {b.tab === "ajudantes" && (
        <FiltroAjudante
          filtros={filtros}
          selecionados={ajudantes}
          aoMudar={(v) => {
            mudar({ ajudantes: v, ajudante: "" });
          }}
        />
      )}
      <InfoTip
        className="self-center"
        texto="Filtros independentes de veículo e de motorista, com múltipla seleção. As listas são encadeadas: ao escolher placas, aparecem só os motoristas que rodaram nelas (e vice-versa). Quando a entrega não foi registrada pelo aplicativo do motorista, a carga aparece sem placa e sem motorista."
      />
      <SeletorDaLista
        rotulo="Status"
        valor={b.status}
        aoMudar={(status) => {
          mudar({ status });
        }}
        opcoes={[
          { valor: "todos", rotulo: "Todos" },
          { valor: "andamento", rotulo: "Só em andamento (sem entregues e baixados)" },
        ]}
        resumo={b.status === "andamento" ? "Só em andamento" : "Todos"}
      />
      <InfoTip
        className="self-center"
        texto="“Todos” mostra o período inteiro na tabela; “Só em andamento” esconde as cargas já entregues e as baixadas sem entrega (devolução, cancelamento…). Os cards acima continuam mostrando o total do período."
      />
      <CampoAdiado
        valor={b.ctrc}
        aoMudar={(ctrc) => {
          mudar({ ctrc });
        }}
        placeholder="CTRC..."
        className="w-[160px]"
      />
      <CampoAdiado
        valor={b.nf}
        aoMudar={(nf) => {
          mudar({ nf });
        }}
        placeholder="Nota fiscal..."
        className="w-[160px]"
      />
    </>
  );
}
