/**
 * Base de data ("Contar as cargas pela") e barra de filtros do topo, comuns a todas as abas
 * menos Hoje, com a faixa "Filtrando por". Visual da tela de hoje.
 */
import { SEM_TIPO } from "@erp/dominio/romaneio/hoje";
import { type CampoData, type FiltrosRomaneio } from "@erp/shared/contratos/romaneio";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { formatarData } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { useState } from "react";

import { FiltroMultiplo } from "@/componentes/comum/FiltroMultiplo";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltroOpcional,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { FiltroTexto } from "@/componentes/comum/FiltroTexto";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { type Intervalo } from "@/componentes/comum/periodo";
import { Button } from "@/componentes/ui/button";
import { Calendar } from "@/componentes/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { cn } from "@/lib/utils";

import { consultaOpcoes, consultaPerformanceAjudantes } from "./api";
import { baseAtual, type BuscaRomaneio, codigosDaBusca, comSingular, veTodos } from "./busca";
import { CampoAdiado } from "./componentes";

const BASES_DATA: readonly { id: CampoData; rotulo: string }[] = [
  { id: "emissao", rotulo: "Emissão" },
  { id: "saida", rotulo: "Saída para entrega" },
];

interface PropsDaBarra {
  busca: BuscaRomaneio;
  definir: (mudanca: Partial<BuscaRomaneio>) => void;
  intervalo: Intervalo;
  filtros: FiltrosRomaneio;
}

/** Seletor da data que o período filtra (emissão ou saída para entrega). */
export function BaseDeData({ busca: b, definir }: Pick<PropsDaBarra, "busca" | "definir">) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border/70 bg-card px-3 py-2 text-[12px] text-muted-foreground">
      <span>Contar as cargas pela</span>
      <div role="group" className="flex rounded-md border border-border/70 p-0.5">
        {BASES_DATA.map((base) => (
          <button
            key={base.id}
            type="button"
            aria-pressed={b.ver === base.id}
            onClick={() => {
              definir({ ver: base.id, page: 1 });
            }}
            className={cn(
              "rounded-[5px] px-3 py-1 text-[12px] transition-colors",
              b.ver === base.id
                ? "bg-[var(--brand)] text-white"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {base.rotulo}
          </button>
        ))}
      </div>
      <span className="text-foreground">{baseAtual(b.ver).ajuda}</span>
    </div>
  );
}

/** Data prevista de entrega (um dia só). */
function FiltroPrevisao({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const [ano = 1970, mes = 1, dia = 1] = valor.split("-").map(Number);
  return (
    <div className="inline-flex items-center gap-1">
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-7 text-[12px]", valor && "border-[var(--brand)]")}
          >
            <CalendarDays className="mr-1 h-3 w-3" />
            {valor ? `Data prevista · ${formatarData(valor)}` : "Data prevista"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={valor ? new Date(ano, mes - 1, dia) : undefined}
            onSelect={(d) => {
              if (!d) return;
              const m = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              aoMudar(`${String(d.getFullYear())}-${m}-${dd}`);
              setAberto(false);
            }}
            autoFocus
            className="pointer-events-auto p-3"
          />
        </PopoverContent>
      </Popover>
      {valor && (
        <button
          type="button"
          aria-label="Limpar data prevista"
          onClick={() => {
            aoMudar("");
          }}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      <InfoTip texto="Mostra só os CTRC com previsão de entrega neste dia. O prazo vem do SSW; CTRC sem prazo calculado não aparecem." />
    </div>
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
          texto="Filtros independentes de veículo e de motorista, com múltipla seleção. As listas são encadeadas: ao escolher placas, aparecem só os motoristas que rodaram nelas (e vice-versa). Quando a entrega não foi registrada pelo aplicativo do motorista, a carga aparece sem placa e sem motorista."
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[12px]">
              Status: {b.status === "andamento" ? "Só em andamento" : "Todos"}{" "}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => {
                mudar({ status: "todos" });
              }}
            >
              Todos
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                mudar({ status: "andamento" });
              }}
            >
              Só em andamento (sem entregues e baixados)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
          className="w-[150px]"
        />
        <CampoAdiado
          valor={b.nf}
          aoMudar={(nf) => {
            mudar({ nf });
          }}
          placeholder="Nota fiscal..."
          className="w-[150px]"
        />
        <Button
          variant={verTodos ? "default" : "outline"}
          size="sm"
          className="h-7 text-[12px]"
          onClick={() => {
            mudar({ verTodos: !b.verTodos, recorte: "todos" });
          }}
        >
          {verTodos ? "Ver só romaneados" : "Ver todos os CTRC"}
        </Button>
        <InfoTip
          className="self-center"
          texto="Por padrão a tela mostra apenas o que saiu para entrega: entregues, em rota, voltou sem entregar e travado em ocorrência. Ative “Ver todos os CTRC” para incluir também as cargas paradas, sem saída para entrega."
        />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {intervalo.inicio === intervalo.fim
            ? formatarData(intervalo.inicio)
            : `${formatarData(intervalo.inicio)} – ${formatarData(intervalo.fim)}`}
        </span>
      </FiltrosAvancados>
      <FiltrandoPor etiquetas={etiquetas} />
    </>
  );
}
