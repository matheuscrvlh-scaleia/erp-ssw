import { ordenarCodigosDisponiveis, type resolverPeriodo } from "@erp/dominio/performance/tela";
import { type SaidaDe } from "@erp/shared/contrato";
import { type PagadorOpcao } from "@erp/shared/contratos/filtros";
import {
  type BaseDeData,
  BASES_DE_DATA,
  type contratosPerformance,
  type ResumoPerformance,
  SEM_TIPO_DOCUMENTO,
} from "@erp/shared/contratos/performance";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";

import { Alternador } from "@/componentes/comum/Alternador";
import { BuscaDocumento } from "@/componentes/comum/BuscaDocumento";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { SeletorDeFilial } from "@/componentes/comum/SeletorDeFilial";
import { SeletorDePagador } from "@/componentes/comum/SeletorDePagador";
import { SeletorDeTipoDocumento } from "@/componentes/comum/SeletorDeTipoDocumento";
import {
  consultasDoSeletorDeFilial,
  consultaTiposDocumento,
  sugestoesDoCampo,
} from "@/modulos/filtros/api";

import {
  BASE_CURTA,
  type BuscaPerformance,
  DATA_DA_BASE,
  DICA_DA_BASE,
  type ExtraDaLista,
  ROTULO_DA_BASE,
  temFiltroLimpavel,
  type TipoDaLista,
} from "../busca";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Barra de filtros da Performance e o "Filtrando por" logo abaixo. */
export function FiltrosPerformance({
  busca,
  periodo,
  mudar,
  aoLimpar,
  unidades,
  pagadores,
  codigos,
  aoAbrirOcorrencia,
  tiposNoPeriodo,
  aoAbrirTipo,
  abrirLista,
}: {
  busca: BuscaPerformance;
  periodo: ReturnType<typeof resolverPeriodo>;
  mudar: (patch: Partial<BuscaPerformance>) => void;
  aoLimpar: () => void;
  unidades: ResumoPerformance["unidades"] | undefined;
  pagadores: readonly PagadorOpcao[] | undefined;
  codigos: SaidaDe<typeof contratosPerformance.codigosDisponiveis> | undefined;
  aoAbrirOcorrencia: (aberto: boolean) => void;
  tiposNoPeriodo: SaidaDe<typeof contratosPerformance.tiposDocumento> | undefined;
  aoAbrirTipo: (aberto: boolean) => void;
  abrirLista: (tipo: TipoDaLista, extra?: ExtraDaLista) => void;
}) {
  // Contexto dos seletores compartilhados (sugestões e unidade responsável).
  const contexto = {
    ...periodo,
    parceiros: busca.parceiros,
    remetente: busca.remetente,
    destino: busca.destino,
    filiais: busca.filiais,
    codigos: busca.codigos.map(Number).filter((n) => Number.isInteger(n)),
  };

  // "Filtrando por": nomes, nunca ids.
  const nomesUnidades = busca.unidades.map(
    (id) =>
      unidades?.find((u) => u.id === id)?.nome ?? (UUID.test(id) ? "unidade selecionada" : id),
  );
  const nomesParceiros = busca.parceiros.map(
    (cnpj) => pagadores?.find((p) => p.id === cnpj)?.nome ?? cnpj,
  );
  const nomesCodigos = busca.codigos.map((cod) => {
    const descricao = codigos?.find((o) => o.codigo === cod)?.descricao;
    return descricao ? `${cod} — ${descricao}` : cod;
  });
  const nomesTipos = busca.tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t));
  const etiquetas: EtiquetaFiltroOpcional[] = [
    nomesUnidades.length > 0 && {
      rotulo: "Unidade",
      ...resumirNomes(nomesUnidades),
      limpar: () => {
        mudar({ unidades: [] });
      },
    },
    nomesParceiros.length > 0 && {
      rotulo: "Parceiros",
      ...resumirNomes(nomesParceiros),
      limpar: () => {
        mudar({ parceiros: [] });
      },
    },
    busca.filiais.length > 0 && {
      rotulo: "Unidade responsável",
      ...resumirNomes(busca.filiais),
      limpar: () => {
        mudar({ filiais: [] });
      },
    },
    busca.remetente.trim() && {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(busca.remetente)),
      limpar: () => {
        mudar({ remetente: "" });
      },
    },
    busca.destino.trim() && {
      rotulo: "Destino",
      ...resumirNomes(lerFiltroTexto(busca.destino)),
      limpar: () => {
        mudar({ destino: "" });
      },
    },
    nomesCodigos.length > 0 && {
      rotulo: "Ocorrência",
      ...resumirNomes(nomesCodigos),
      limpar: () => {
        mudar({ codigos: [] });
      },
    },
    nomesTipos.length > 0 && {
      rotulo: "Tipo documento",
      ...resumirNomes(nomesTipos),
      limpar: () => {
        mudar({ tipos: [] });
      },
    },
  ];

  return (
    <>
      <FiltrosAvancados ativos={temFiltroLimpavel(busca)} aoLimpar={aoLimpar}>
        <FiltroPeriodo
          periodo={busca.periodo}
          de={busca.de}
          ate={busca.ate}
          rotulo={DATA_DA_BASE[busca.base]}
          aoMudar={(m) => {
            mudar({
              periodo: m.periodo === "mes_anterior" ? "mes" : m.periodo,
              de: m.de,
              ate: m.ate,
            });
          }}
        />
        <Alternador<BaseDeData>
          rotulo="Base de data"
          valor={busca.base}
          aoMudar={(b) => {
            mudar({ base: b });
          }}
          opcoes={BASES_DE_DATA.map((b) => ({
            valor: b,
            rotulo: ROTULO_DA_BASE[b],
            dica: DICA_DA_BASE[b],
          }))}
        />
        <span
          className="hidden text-[12.5px] text-muted-foreground sm:inline"
          title={DICA_DA_BASE[busca.base]}
        >
          {BASE_CURTA[busca.base]}
        </span>
        <SeletorDePagador
          rotulo="Parceiros"
          opcoes={pagadores}
          selecionados={busca.parceiros}
          aoMudar={(ids) => {
            mudar({ parceiros: ids });
          }}
        />
        <SeletorDeFilial
          selecionadas={busca.filiais}
          consultas={consultasDoSeletorDeFilial(contexto)}
          aoMudar={(siglas) => {
            mudar({ filiais: siglas });
          }}
        />
        <FiltroTexto
          rotulo="Remetente"
          valor={busca.remetente}
          sugestoes={sugestoesDoCampo(contexto, "remetente")}
          aoMudar={(v) => {
            mudar({ remetente: v });
          }}
        />
        <FiltroTexto
          rotulo="Destino"
          valor={busca.destino}
          sugestoes={sugestoesDoCampo(contexto, "cidade_destino")}
          aoMudar={(v) => {
            mudar({ destino: v });
          }}
        />
        <span
          className="inline-flex items-center"
          title="Filtra os CT-e cuja ocorrência EFETIVA atual (o status vigente do CT-e) é o código selecionado — o mesmo critério da lista detalhada. Não considera ocorrências antigas já superadas na jornada. Todos os cards, gráficos e a lista respeitam esse filtro."
        >
          <FiltroMultiplo
            rotulo="Ocorrência"
            textoVazio="todos"
            opcoes={
              codigos
                ? ordenarCodigosDisponiveis(codigos).map((o) => ({
                    valor: o.codigo,
                    rotulo: `${o.codigo} — ${o.descricao ?? "sem descrição"}`,
                    detalhe: String(o.qtd),
                  }))
                : undefined
            }
            aoAbrir={aoAbrirOcorrencia}
            selecionados={busca.codigos}
            aoMudar={(ids) => {
              mudar({ codigos: ids });
            }}
          />
        </span>
        <SeletorDeTipoDocumento
          contagens={tiposNoPeriodo}
          aoAbrir={aoAbrirTipo}
          consultaTipos={consultaTiposDocumento}
          selecionados={busca.tipos}
          aoMudar={(ids) => {
            mudar({ tipos: ids });
          }}
        />
        <BuscaDocumento
          valor=""
          placeholder="CTRC..."
          className="w-[150px]"
          aoMudar={(v) => {
            if (v) abrirLista("emitidos", { ctrc: v, ignorarPeriodo: true });
          }}
        />
        <BuscaDocumento
          valor=""
          placeholder="Nota fiscal..."
          className="w-[150px]"
          aoMudar={(v) => {
            if (v) abrirLista("emitidos", { nf: v, ignorarPeriodo: true });
          }}
        />
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
