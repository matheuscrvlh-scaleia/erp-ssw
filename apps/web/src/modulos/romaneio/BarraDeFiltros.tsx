/**
 * Filtros do Romaneio (slot `filtros` do `Pagina`), comuns a todas as abas menos Hoje: base de
 * data ("Contar as cargas pela") e universo na primeira linha; período, parceiros e unidade
 * sempre à vista; o resto em "Mais filtros"; e a faixa "Filtrando por".
 */
import { SEM_TIPO } from "@erp/dominio/romaneio/hoje";
import { type CampoData, type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { formatarData } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { Alternador } from "@/componentes/comum/Alternador";
import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { GatilhoFiltro } from "@/componentes/comum/GatilhoFiltro";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { type Intervalo } from "@/componentes/comum/periodo";
import { Button } from "@/componentes/ui/button";
import { Calendar } from "@/componentes/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { dataDoCalendario, isoDoCalendario } from "@/lib/dia-do-calendario";

import { consultaOpcoes, consultaPerformanceAjudantes } from "./api";
import { baseAtual, type BuscaRomaneio, codigosDaBusca, comSingular, veTodos } from "./busca";
import { CampoAdiado, SeletorDaLista } from "./componentes";

const BASES_DATA: readonly { valor: CampoData; rotulo: string }[] = [
  { valor: "emissao", rotulo: "Emissão" },
  { valor: "saida", rotulo: "Saída para entrega" },
];

const CHAVE_MAIS_FILTROS = "romaneio:mais-filtros";

interface PropsDaBarra {
  busca: BuscaRomaneio;
  definir: (mudanca: Partial<BuscaRomaneio>) => void;
  intervalo: Intervalo;
  filtros: FiltrosRomaneio;
}

/** Data prevista de entrega (um dia só). */
function FiltroPrevisao({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <GatilhoFiltro
          ativo={Boolean(valor)}
          rotulo="Data prevista"
          aoLimpar={() => {
            aoMudar("");
          }}
        >
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden />
          {valor ? `Data prevista · ${formatarData(valor)}` : "Data prevista"}
        </GatilhoFiltro>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={valor ? dataDoCalendario(valor) : undefined}
          onSelect={(d) => {
            if (!d) return;
            aoMudar(isoDoCalendario(d));
            setAberto(false);
          }}
          autoFocus
          className="pointer-events-auto p-3"
        />
      </PopoverContent>
    </Popover>
  );
}

/** Ajudantes do período (as opções são os nomes da própria aba, sem o filtro de ajudante). */
function FiltroAjudante({
  filtros,
  selecionados,
  aoMudar,
}: {
  filtros: FiltrosRomaneio;
  selecionados: readonly string[];
  aoMudar: (v: string[]) => void;
}) {
  const semAjudante: FiltrosRomaneio = { ...filtros };
  delete semAjudante.ajudantes;
  const q = useQuery(consultaPerformanceAjudantes(semAjudante));
  const nomes = q.data
    ? [...new Set(q.data.map((r) => r.nome))].sort((a, b) => a.localeCompare(b, "pt-BR"))
    : undefined;
  return (
    <FiltroMultiplo
      rotulo="Ajudante"
      opcoes={nomes?.map((valor) => ({ valor }))}
      selecionados={selecionados}
      aoMudar={aoMudar}
      textoVazio="todos"
    />
  );
}

/** "Mais filtros" aberto ou fechado: preferência do navegador (começa fechado). */
function useMaisFiltros() {
  const [aberto, setAberto] = useState(() => {
    try {
      return window.localStorage.getItem(CHAVE_MAIS_FILTROS) === "1";
    } catch {
      return false;
    }
  });
  const alternar = () => {
    setAberto((atual) => {
      try {
        window.localStorage.setItem(CHAVE_MAIS_FILTROS, atual ? "0" : "1");
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      return !atual;
    });
  };
  return { aberto, alternar };
}

export function BarraDeFiltros({ busca: b, definir, intervalo, filtros }: PropsDaBarra) {
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
        )}
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
