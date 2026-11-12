/**
 * Filtros do Romaneio (slot `filtros` do `Pagina`), comuns a todas as abas menos Hoje: base de
 * data ("Contar as cargas pela") e universo na primeira linha; período, parceiros e unidade
 * sempre à vista; o resto em "Mais filtros"; e a faixa "Filtrando por".
 */
import { SEM_TIPO } from "@erp/dominio/romaneio/hoje";
import { type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { formatarData } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

import { Alternador } from "@/componentes/comum/Alternador";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { type Intervalo } from "@/componentes/comum/periodo";
import { Button } from "@/componentes/ui/button";

import { consultaOpcoes } from "../api";
import { type BuscaRomaneio, codigosDaBusca, comSingular, veTodos } from "../busca";
import { baseAtual, BASES_DATA } from "../textos";
import { useMaisFiltros } from "../use-mais-filtros";
import { MaisFiltros } from "./MaisFiltros";

interface PropsDaBarra {
  busca: BuscaRomaneio;
  definir: (mudanca: Partial<BuscaRomaneio>) => void;
  intervalo: Intervalo;
  filtros: FiltrosRomaneio;
}

export function FiltrosGerais({ busca: b, definir, intervalo, filtros }: PropsDaBarra) {
  const escopo = { campo: b.ver, inicio: intervalo.inicio, fim: intervalo.fim };
  const placas = comSingular(b.placas, b.placa);
  const motoristas = comSingular(b.motoristas, b.motorista);
  const ajudantes = comSingular(b.ajudantes, b.ajudante);
  const codigos = codigosDaBusca(b).map(String);
  const opcoes = useQuery(consultaOpcoes(escopo)).data;
  // Encadeamento: as placas consideram os motoristas escolhidos e vice-versa.
  const comMotoristas = useQuery({
    ...consultaOpcoes({ ...escopo, motoristas }),
    enabled: motoristas.length > 0,
  }).data;
  const comPlacas = useQuery({
    ...consultaOpcoes({ ...escopo, placas }),
    enabled: placas.length > 0,
  }).data;
  const opcoesDePlaca = motoristas.length > 0 ? comMotoristas?.placas : opcoes?.placas;
  const opcoesDeMotorista = placas.length > 0 ? comPlacas?.motoristas : opcoes?.motoristas;
  const nomeDoPagador = new Map(opcoes?.pagadores.map((p) => [p.cnpj, p.nome]));
  const descricaoDoCodigo = new Map(opcoes?.codigos.map((c) => [String(c.codigo), c.descricao]));
  const base = baseAtual(b.ver);
  const maisFiltros = useMaisFiltros();
  const mudar = (mudanca: Partial<BuscaRomaneio>) => {
    definir({ ...mudanca, page: 1 });
  };

  const etiquetaLista = (
    singular: string,
    plural: string,
    nomes: readonly string[],
    limpar: Partial<BuscaRomaneio>,
  ): EtiquetaFiltroOpcional =>
    nomes.length > 0 && {
      rotulo: nomes.length === 1 ? singular : plural,
      ...resumirNomes(nomes),
      limpar: () => {
        mudar(limpar);
      },
    };
  const etiquetas: EtiquetaFiltroOpcional[] = [
    etiquetaLista(
      "Parceiro",
      "Parceiros",
      b.parceiros.map((c) => nomeDoPagador.get(c) ?? c),
      { parceiros: [] },
    ),
    etiquetaLista("Unidade responsável", "Unidade responsável", b.filiais, { filiais: [] }),
    etiquetaLista("Local. atual", "Local. atual", b.unidadeAtual, { unidadeAtual: [] }),
    b.remetente.trim() && {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(b.remetente)),
      limpar: () => {
        mudar({ remetente: "" });
      },
    },
    b.destino.trim() && {
      rotulo: "Destino",
      ...resumirNomes(lerFiltroTexto(b.destino)),
      limpar: () => {
        mudar({ destino: "" });
      },
    },
    etiquetaLista(
      "Código",
      "Códigos",
      codigos.map((c) => `#${c}`),
      { codigos: [], codigo: "" },
    ),
    etiquetaLista(
      "Tipo documento",
      "Tipo documento",
      b.tipos.map((t) => (t === SEM_TIPO ? "sem tipo" : t)),
      { tipos: [] },
    ),
    b.previsao && {
      rotulo: "Data prevista",
      valor: formatarData(b.previsao),
      limpar: () => {
        mudar({ previsao: "" });
      },
    },
    etiquetaLista("Placa", "Placas", placas, { placas: [], placa: "" }),
    b.tab !== "ajudantes" &&
      etiquetaLista("Motorista", "Motoristas", motoristas, { motoristas: [], motorista: "" }),
    b.tab === "ajudantes" &&
      etiquetaLista("Ajudante", "Ajudantes", ajudantes, { ajudantes: [], ajudante: "" }),
    b.ctrc.trim() && {
      rotulo: "CTRC",
      valor: b.ctrc.trim(),
      limpar: () => {
        mudar({ ctrc: "" });
      },
    },
    b.nf.trim() && {
      rotulo: "Nota fiscal",
      valor: b.nf.trim(),
      limpar: () => {
        mudar({ nf: "" });
      },
    },
  ];

  // Quantos filtros ligados estão dentro de "Mais filtros" (aparece no botão quando fechado).
  const ocultosAtivos = [
    b.unidadeAtual.length > 0,
    b.remetente.trim() !== "",
    b.destino.trim() !== "",
    codigos.length > 0,
    b.tipos.length > 0,
    b.previsao !== "",
    placas.length > 0,
    (b.tab === "ajudantes" ? ajudantes : motoristas).length > 0,
    b.status !== "todos",
    b.ctrc !== "",
    b.nf !== "",
  ].filter(Boolean).length;

  const algumFiltro = Boolean(
    b.remetente ||
    b.destino ||
    b.filiais.length ||
    b.unidadeAtual.length ||
    codigos.length ||
    b.de ||
    b.ate ||
    b.previsao ||
    b.semMovimento ||
    placas.length ||
    motoristas.length ||
    ajudantes.length ||
    b.ctrc ||
    b.nf ||
    b.busca ||
    b.tipos.length ||
    b.romaneado !== "todos" ||
    b.status !== "todos",
  );
  const limparTudo = () => {
    mudar({
      remetente: "",
      destino: "",
      filiais: [],
      unidadeAtual: [],
      codigos: [],
      codigo: "",
      de: "",
      ate: "",
      previsao: "",
      semMovimento: false,
      placas: [],
      placa: "",
      motoristas: [],
      motorista: "",
      ajudantes: [],
      ajudante: "",
      ctrc: "",
      nf: "",
      busca: "",
      tipos: [],
      romaneado: "todos",
      status: "todos",
      periodo: b.periodo === "custom" ? "mes" : b.periodo,
    });
  };
  const verTodos = veTodos(b);

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="label-xs">Contar as cargas pela</span>
        <Alternador
          rotulo="Contar as cargas pela"
          tamanho="pequeno"
          opcoes={BASES_DATA}
          valor={b.ver}
          aoMudar={(ver) => {
            definir({ ver, page: 1 });
          }}
        />
        <span className="text-[13px] text-foreground">{base.ajuda}</span>
        <span className="inline-flex items-center gap-1.5">
          <Button
            variant={verTodos ? "default" : "outline"}
            size="sm"
            aria-pressed={verTodos}
            onClick={() => {
              mudar({ verTodos: !b.verTodos, recorte: "todos" });
            }}
          >
            {verTodos ? "Ver só romaneados" : "Ver todos os CTRC"}
          </Button>
          <InfoTip texto="Por padrão a tela mostra apenas o que saiu para entrega: entregues, em rota, voltou sem entregar e travado em ocorrência. Ative “Ver todos os CTRC” para incluir também as cargas paradas, sem saída para entrega." />
        </span>
        <span className="ml-auto text-[12.5px] text-muted-foreground tabular-nums">
          {intervalo.inicio === intervalo.fim
            ? formatarData(intervalo.inicio)
            : `${formatarData(intervalo.inicio)} – ${formatarData(intervalo.fim)}`}
        </span>
      </div>
      <FiltrosAvancados ativos={algumFiltro} aoLimpar={limparTudo}>
        <FiltroPeriodo
          periodo={b.periodo}
          de={b.de}
          ate={b.ate}
          aoMudar={({ periodo, de, ate }) => {
            mudar({ periodo, de, ate });
          }}
        />
        <InfoTip texto={`Período ${base.curto}. ${base.texto}`} className="self-center" />
        <FiltroMultiplo
          rotulo="Parceiros"
          opcoes={opcoes?.pagadores.map((p) => ({ valor: p.cnpj, rotulo: p.nome }))}
          selecionados={b.parceiros}
          aoMudar={(parceiros) => {
            mudar({ parceiros });
          }}
          textoVazio="todos"
        />
        <FiltroMultiplo
          rotulo="Unidade responsável"
          opcoes={opcoes?.filiais.map((f) => ({ valor: f.sigla, detalhe: f.nome }))}
          selecionados={b.filiais}
          aoMudar={(filiais) => {
            mudar({ filiais });
          }}
          monoespacado
        />
        <Button
          variant="outline"
          className="h-9 text-[13px]"
          aria-expanded={maisFiltros.aberto}
          onClick={maisFiltros.alternar}
        >
          <SlidersHorizontal aria-hidden />
          Mais filtros
          {!maisFiltros.aberto && ocultosAtivos > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[12px] font-bold text-primary-foreground tabular-nums">
              {ocultosAtivos}
            </span>
          )}
          {maisFiltros.aberto ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
        </Button>
        {maisFiltros.aberto && (
          <MaisFiltros
            busca={b}
            mudar={mudar}
            filtros={filtros}
            opcoes={opcoes}
            opcoesDePlaca={opcoesDePlaca}
            opcoesDeMotorista={opcoesDeMotorista}
            placas={placas}
            motoristas={motoristas}
            ajudantes={ajudantes}
            codigos={codigos}
            descricaoDoCodigo={descricaoDoCodigo}
          />
        )}
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
