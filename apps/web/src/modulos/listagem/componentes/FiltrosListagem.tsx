import { type PagadorOpcao } from "@erp/shared/contratos/filtros";
import {
  type BaseData,
  BASES_DATA,
  type FiltroListaEntrada,
  type TipoRecorte,
} from "@erp/shared/contratos/listagem";

import { Alternador } from "@/componentes/comum/Alternador";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  etiquetasQueLimpam,
  FiltrandoPor,
  FiltrosAvancados,
} from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import {
  BuscaDocumento,
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDeTexto,
} from "@/modulos/filtros/componentes";
import { nomesDosPagadores } from "@/modulos/filtros/regras";

import { type BuscaDaLista, rotulosDosRecortes } from "../busca";
import {
  BASE_CURTA,
  DATA_DA_BASE,
  DICA_DA_BASE,
  etiquetasDaLista,
  ROTULO_DA_BASE,
} from "../textos";
import { MaisFiltros } from "./MaisFiltros";
import { SeletorDeOcorrencia } from "./SeletorDeOcorrencia";
import { SeletorDeRecorte } from "./SeletorDeRecorte";

const FILTROS_LIMPOS = {
  unidades: [],
  filiais: [],
  parceiros: [],
  remetente: "",
  busca: "",
  ctrc: "",
  nf: "",
  destino: "",
  codigos: [],
  tipos: [],
  cidade: "",
  peso_min: null,
  peso_max: null,
  atraso_min: null,
  atraso_max: null,
} satisfies Partial<BuscaDaLista>;

/**
 * Filtros da Listagem (período, base, recortes e os seletores) e a faixa "Filtrando por". Cada
 * mudança vai para a URL por `aoMudar`.
 */
export function FiltrosListagem({
  busca,
  periodo,
  recortes,
  filtro,
  nomeCurto,
  pagadores,
  porCodigo,
  aoMudar,
}: {
  busca: BuscaDaLista;
  periodo: { inicio: string; fim: string };
  recortes: readonly TipoRecorte[];
  filtro: FiltroListaEntrada;
  nomeCurto: string;
  pagadores: PagadorOpcao[];
  porCodigo: readonly { codigo: number; descricao: string | null }[];
  aoMudar: (mudanca: Partial<BuscaDaLista>) => void;
}) {
  const temRecorte = (r: TipoRecorte) => recortes.includes(r);
  const contexto: ContextoDosFiltros = {
    inicio: periodo.inicio,
    fim: periodo.fim,
    filiais: busca.filiais.length > 0 ? busca.filiais : undefined,
    remetente: busca.remetente || undefined,
    destino: busca.destino || undefined,
  };

  const etiquetas = etiquetasQueLimpam(
    etiquetasDaLista(busca, recortes, nomesDosPagadores(pagadores, busca.parceiros), porCodigo),
    aoMudar,
  );
  const filtrosAtivos =
    etiquetas.some((e) => e.valor !== "") || busca.unidades.length > 0 || busca.tipos.length > 0;
  const maisFiltrosAtivos =
    busca.cidade !== "" ||
    busca.peso_min !== null ||
    busca.peso_max !== null ||
    busca.atraso_min !== null ||
    busca.atraso_max !== null;

  return (
    <>
      <FiltrosAvancados
        ativos={filtrosAtivos}
        aoLimpar={() => {
          aoMudar(FILTROS_LIMPOS);
        }}
      >
        <FiltroPeriodo
          periodo={busca.periodo}
          de={busca.de}
          ate={busca.ate}
          rotulo={DATA_DA_BASE[busca.base]}
          aoMudar={(p) => {
            aoMudar(p);
          }}
        />
        <Alternador<BaseData>
          rotulo="Base de data"
          valor={busca.base}
          aoMudar={(b) => {
            aoMudar({ base: b });
          }}
          opcoes={BASES_DATA.map((b) => ({
            valor: b,
            rotulo: ROTULO_DA_BASE[b],
            dica: DICA_DA_BASE[b],
          }))}
        />
        <span className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground">
          <InfoTip texto={DICA_DA_BASE[busca.base]} />
          <span className="hidden sm:inline">{BASE_CURTA[busca.base]}</span>
        </span>
        <SeletorDeRecorte
          rotulos={rotulosDosRecortes(nomeCurto)}
          selecionados={recortes}
          aoMudar={(marcados) => {
            const [tipo = "emitidos", ...extras] = marcados;
            // "Saíram para entrega" entra já filtrado nos códigos em aberto.
            const entrouSaiu =
              marcados.includes("nascido_atrasado") && !temRecorte("nascido_atrasado");
            aoMudar({
              tipo,
              recortes: extras.length > 0 ? extras : undefined,
              abertos: entrouSaiu || undefined,
            });
          }}
        />
        <SeletorDeFilial
          selecionadas={busca.filiais}
          aoMudar={(filiais) => {
            aoMudar({ filiais });
          }}
          contexto={contexto}
        />
        <SeletorDePagador
          rotulo="Parceiros"
          opcoes={pagadores}
          selecionados={busca.parceiros}
          aoMudar={(parceiros) => {
            aoMudar({ parceiros });
          }}
        />
        <SeletorDeTexto
          rotulo="Remetente"
          campo="remetente"
          valor={busca.remetente}
          aoMudar={(remetente) => {
            aoMudar({ remetente });
          }}
          contexto={contexto}
        />
        <SeletorDeTexto
          rotulo="Destino"
          campo="cidade_destino"
          valor={busca.destino}
          aoMudar={(destino) => {
            aoMudar({ destino });
          }}
          contexto={contexto}
        />
        {/* Ocorrência efetiva — também muda pelo clique no gráfico "Ocorrências". */}
        <SeletorDeOcorrencia
          filtro={filtro}
          selecionados={busca.codigos}
          nomeCurto={nomeCurto}
          aoMudar={(codigos) => {
            aoMudar({ codigos });
          }}
        />
        <MaisFiltros
          key={`${busca.cidade}|${String(busca.peso_min)}|${String(busca.peso_max)}|${String(busca.atraso_min)}|${String(busca.atraso_max)}`}
          busca={busca}
          ativo={maisFiltrosAtivos}
          aoMudar={aoMudar}
        />
        <BuscaDocumento
          valor={busca.ctrc}
          placeholder="CTRC..."
          className="w-[150px]"
          aoMudar={(ctrc) => {
            aoMudar({ ctrc });
          }}
        />
        <BuscaDocumento
          valor={busca.nf}
          placeholder="Nota fiscal..."
          className="w-[150px]"
          aoMudar={(nf) => {
            aoMudar({ nf });
          }}
        />
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
