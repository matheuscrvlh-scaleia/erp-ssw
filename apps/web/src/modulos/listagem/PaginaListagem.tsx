import { codigoEmAbertoNoRecorte } from "@erp/dominio/listagem/faixas";
import { SEM_TIPO_DOCUMENTO } from "@erp/shared/contratos/filtros";
import {
  ITENS_POR_PAGINA,
  recortesSelecionados,
  type TipoRecorte,
} from "@erp/shared/contratos/listagem";
import { hojeNoFuso } from "@erp/shared/datas";
import { lerFiltroTexto } from "@erp/shared/filtro-texto";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { ArrowLeft, Filter, RefreshCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { consultaAcesso } from "@/acesso/sessao";
import { BotoesDePagina } from "@/componentes/comum/BotoesDePagina";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { FiltroPeriodo } from "@/componentes/comum/FiltroPeriodo";
import {
  type EtiquetaFiltro,
  FiltrandoPor,
  FiltrosAvancados,
  resumirNomes,
} from "@/componentes/comum/FiltrosAvancados";
import { InfoTip } from "@/componentes/comum/InfoTip";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
import { consultaPagadores } from "@/modulos/filtros/api";
import {
  BuscaDocumento,
  type ContextoDosFiltros,
  SeletorDeFilial,
  SeletorDePagador,
  SeletorDeTexto,
} from "@/modulos/filtros/componentes";
import { nomesDosPagadores } from "@/modulos/filtros/regras";
import { SeloDosDados } from "@/modulos/ingestao-ssw/SeloDosDados";

import {
  carregarTodasAsLinhas,
  CHAVE_DA_LISTAGEM,
  consultaCodigosDoRecorte,
  consultaLista,
  LIMITE_DA_EXPORTACAO,
  type Ordenacao,
} from "./api";
import {
  type BuscaDaLista,
  filtroDaBusca,
  periodoDaLista,
  rotulosDosRecortes,
  tituloDaLista,
} from "./busca";
import { COLUNAS_DA_EXPORTACAO, linhaExportada, nomeDoArquivo } from "./exportacao";
import { GraficoDeBarras } from "./GraficoDeBarras";
import { SeletorDeOcorrencia } from "./SeletorDeOcorrencia";
import { SeletorDeRecorte } from "./SeletorDeRecorte";
import { TabelaCtrcs } from "./TabelaCtrcs";
import { textoDaFaixa } from "./textos";

const rota = getRouteApi("/_autenticado/performance/lista");

const BASES = ["emissao", "prevista", "concluido"] as const;
type Base = (typeof BASES)[number];
const ROTULO_DA_BASE: Record<Base, string> = {
  emissao: "Emitidos",
  prevista: "Data Prevista",
  concluido: "Concluídos",
};
const DATA_DA_BASE: Record<Base, string> = {
  emissao: "Emissão",
  prevista: "Prevista",
  concluido: "Concluído",
};
const DICA_DA_BASE: Record<Base, string> = {
  emissao: "O período filtra pela data de emissão do CT-e.",
  prevista: "O período filtra pela data prevista de entrega.",
  concluido: "O período filtra pela data de entrega ou de baixa no sistema.",
};
const BASE_CURTA: Record<Base, string> = {
  emissao: "por data de emissão",
  prevista: "por data prevista",
  concluido: "por data de conclusão",
};
/** Recortes que mostram o gráfico "Dias de Atraso". */
const RECORTES_COM_FAIXA: readonly TipoRecorte[] = [
  "atrasados",
  "fora_prazo",
  "por_faixa_atraso",
  "previstos_por_faixa",
  "sem_movimento",
  "nascido_atrasado",
  "ocorr_em_atraso",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function numeroOuNulo(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

/**
 * Listagem detalhada de CT-e: um filtro único (recortes + filtros) alimenta a tabela paginada, o
 * total, os quatro gráficos e a exportação.
 * origem: src/routes/_authenticated/performance.lista.tsx (sistema atual)
 */
export function PaginaListagem() {
  const { data: acesso } = useSuspenseQuery(consultaAcesso);
  const nomeCurto = acesso.empresa?.nomeCurto ?? "transportadora";
  const busca = rota.useSearch();
  const navegar = rota.useNavigate();
  const queryClient = useQueryClient();

  const hoje = hojeNoFuso(acesso.empresa?.fuso ?? "America/Sao_Paulo");
  const periodo = useMemo(
    () => periodoDaLista({ periodo: busca.periodo, de: busca.de, ate: busca.ate }, hoje),
    [busca.periodo, busca.de, busca.ate, hoje],
  );
  const filtro = useMemo(() => filtroDaBusca(busca, periodo), [busca, periodo]);
  const recortes = useMemo(
    () => recortesSelecionados(busca.tipo, busca.recortes),
    [busca.tipo, busca.recortes],
  );
  const temRecorte = (r: TipoRecorte) => recortes.includes(r);
  const ordenacao: Ordenacao = { ordem: busca.sort, direcao: busca.dir };

  const atualizarBusca = (mudanca: Partial<BuscaDaLista>) => {
    void navegar({
      search: (anterior) => ({ ...anterior, ...mudanca, page: mudanca.page ?? 1 }),
    });
  };

  // Com `abertos` (alerta ou recorte "Saíram para entrega"): marca no seletor Ocorrência os
  // códigos em aberto do recorte e só então carrega a lista. O filtro fica visível e pode ser
  // limpo para ver também os finalizados.
  const codigosAbertos = useQuery({
    ...consultaCodigosDoRecorte(filtro),
    enabled: busca.abertos === true,
  });
  useEffect(() => {
    if (!busca.abertos || (!codigosAbertos.data && !codigosAbertos.isError)) return;
    const emAberto = (codigo: number, tipo: string | null) =>
      recortes.some((r) => codigoEmAbertoNoRecorte(r, { codigo, tipo }));
    const tipoDe = (codigo: number) =>
      codigosAbertos.data?.find((c) => c.codigo === codigo)?.tipo ?? null;
    const codigos =
      busca.codigos.length > 0
        ? busca.codigos.filter((c) => emAberto(c, tipoDe(c)))
        : (codigosAbertos.data ?? [])
            .filter((c) => emAberto(c.codigo, c.tipo))
            .map((c) => c.codigo);
    void navegar({
      replace: true,
      search: (anterior) => ({ ...anterior, abertos: undefined, codigos, page: 1 }),
    });
  }, [
    busca.abertos,
    busca.codigos,
    recortes,
    codigosAbertos.data,
    codigosAbertos.isError,
    navegar,
  ]);

  const lista = useQuery({
    ...consultaLista(filtro, ordenacao, busca.page),
    enabled: busca.abertos !== true,
  });
  const pagadores = useQuery(
    consultaPagadores({
      inicio: periodo.inicio,
      fim: periodo.fim,
      unidades: busca.unidades.length > 0 ? busca.unidades : undefined,
      filiais: busca.filiais.length > 0 ? busca.filiais : undefined,
    }),
  );

  const total = lista.data?.total ?? 0;
  const linhas = lista.data?.linhas ?? [];
  const porCodigo = lista.data?.porCodigo ?? [];
  const porUnidade = lista.data?.porUnidade ?? [];
  const porCidade = lista.data?.porCidade ?? [];
  const porFaixa = lista.data?.porFaixa ?? [];
  const totalDePaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const mostrarFaixa = RECORTES_COM_FAIXA.some(temRecorte);
  const soPorFaixa = recortes.length === 1 && busca.tipo === "por_faixa_atraso";

  const contexto: ContextoDosFiltros = {
    inicio: periodo.inicio,
    fim: periodo.fim,
    filiais: busca.filiais.length > 0 ? busca.filiais : undefined,
    remetente: busca.remetente || undefined,
    destino: busca.destino || undefined,
  };

  // ------------------------------------------------------------ etiquetas "Filtrando por"
  // "Penalizados em XXX" já leva a unidade no título.
  const unidadeNoTitulo =
    busca.unidades.length === 1 &&
    recortes.some((r) => r === "penalizados" || r === "penalizados_abertos");
  const nomesDasUnidades = busca.unidades.map((u) => (UUID.test(u) ? "unidade selecionada" : u));
  const nomesDosParceiros = nomesDosPagadores(pagadores.data ?? [], busca.parceiros);
  const nomesDosCodigos = busca.codigos.map((c) => {
    const descricao = porCodigo.find((a) => a.codigo === c)?.descricao;
    return descricao ? `${c} — ${descricao}` : String(c);
  });
  const nomesDosTipos = busca.tipos.map((t) => (t === SEM_TIPO_DOCUMENTO ? "sem tipo" : t));
  const etiquetas: EtiquetaFiltro[] = [
    {
      rotulo: "CTRC",
      valor: busca.ctrc.trim(),
      limpar: () => {
        atualizarBusca({ ctrc: "" });
      },
    },
    {
      rotulo: "Nota fiscal",
      valor: busca.nf.trim(),
      limpar: () => {
        atualizarBusca({ nf: "" });
      },
    },
    {
      rotulo: "Busca",
      valor: busca.busca.trim(),
      limpar: () => {
        atualizarBusca({ busca: "" });
      },
    },
    {
      rotulo: "Unidade",
      ...resumirNomes(unidadeNoTitulo ? [] : nomesDasUnidades),
      limpar: () => {
        atualizarBusca({ unidades: [] });
      },
    },
    {
      rotulo: "Unidade responsável",
      ...resumirNomes(busca.filiais),
      limpar: () => {
        atualizarBusca({ filiais: [] });
      },
    },
    {
      rotulo: "Parceiros",
      ...resumirNomes(nomesDosParceiros),
      limpar: () => {
        atualizarBusca({ parceiros: [] });
      },
    },
    {
      rotulo: "Remetente",
      ...resumirNomes(lerFiltroTexto(busca.remetente)),
      limpar: () => {
        atualizarBusca({ remetente: "" });
      },
    },
    {
      rotulo: "Destino",
      ...resumirNomes(lerFiltroTexto(busca.destino)),
      limpar: () => {
        atualizarBusca({ destino: "" });
      },
    },
    {
      rotulo: "Ocorrência",
      ...resumirNomes(nomesDosCodigos),
      limpar: () => {
        atualizarBusca({ codigos: [] });
      },
    },
    {
      rotulo: "Tipo documento",
      ...resumirNomes(nomesDosTipos),
      limpar: () => {
        atualizarBusca({ tipos: [] });
      },
    },
    {
      rotulo: "Cidade destino",
      valor: busca.cidade.trim(),
      limpar: () => {
        atualizarBusca({ cidade: "" });
      },
    },
    {
      rotulo: "Peso",
      valor: textoDaFaixa(busca.peso_min, busca.peso_max, "kg"),
      limpar: () => {
        atualizarBusca({ peso_min: null, peso_max: null });
      },
    },
    {
      rotulo: "Atraso",
      valor: textoDaFaixa(busca.atraso_min, busca.atraso_max, "dias"),
      limpar: () => {
        atualizarBusca({ atraso_min: null, atraso_max: null });
      },
    },
  ];
  const filtrosAtivos =
    etiquetas.some((e) => e.valor !== "") || busca.unidades.length > 0 || busca.tipos.length > 0;
  const maisFiltrosAtivos =
    busca.cidade !== "" ||
    busca.peso_min !== null ||
    busca.peso_max !== null ||
    busca.atraso_min !== null ||
    busca.atraso_max !== null;

  // ------------------------------------------------------------ exportação
  const titulo = tituloDaLista(busca, periodo.rotulo, nomeCurto);
  const subtitulo = [
    `Período: ${periodo.inicio} → ${periodo.fim}`,
    busca.unidades.length ? `Unidades: ${nomesDasUnidades.join(", ")}` : null,
    busca.parceiros.length ? `Parceiros: ${busca.parceiros.length}` : null,
    busca.codigos.length ? `Códigos: ${busca.codigos.join(", ")}` : null,
    busca.filiais.length ? `Filiais: ${busca.filiais.join(", ")}` : null,
    busca.remetente ? `Remetente: ${busca.remetente}` : null,
    busca.destino ? `Destino: ${busca.destino}` : null,
    busca.cidade ? `Cidade: ${busca.cidade}` : null,
  ]
    .filter((p) => p !== null)
    .join(" · ");
  /** Todas as páginas do filtro (Q04: sem corte silencioso — passou do teto, avisa). */
  const carregarParaExportar = async () => {
    const { linhas: todas, cortada } = await carregarTodasAsLinhas(filtro, ordenacao);
    if (cortada) {
      toast.warning(
        `O arquivo saiu com os primeiros ${LIMITE_DA_EXPORTACAO.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} CTRCs (na ordem da tela). Reduza o período ou aplique mais filtros para exportar o restante.`,
      );
    }
    return todas.map(linhaExportada);
  };

  const atualizar = () => queryClient.invalidateQueries({ queryKey: CHAVE_DA_LISTAGEM });
  const voltar = () => {
    if (window.history.length > 1) window.history.back();
    else void navegar({ to: "/" });
  };

  const acoes = (
    <>
      <Button variant="ghost" size="sm" className="h-8" onClick={() => void atualizar()}>
        <RefreshCw className="mr-1.5 h-3 w-3" />
        Atualizar
      </Button>
      <ExportMenu
        arquivo={nomeDoArquivo(recortes, periodo.inicio, periodo.fim)}
        titulo={titulo}
        subtitulo={subtitulo}
        colunas={COLUNAS_DA_EXPORTACAO}
        linhas={[]}
        carregarLinhas={carregarParaExportar}
        desabilitado={total === 0}
        tamanhoFonte={5.5}
        className="h-8"
      />
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex items-center justify-between gap-2 sm:min-w-0 sm:justify-start sm:gap-3">
          <button
            type="button"
            onClick={voltar}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-card px-2 text-[12px] hover:bg-muted"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar
          </button>
          <h1 className="hidden truncate text-lg font-semibold sm:block">{titulo}</h1>
          <div className="flex items-center gap-2 sm:hidden">{acoes}</div>
        </div>
        <h1 className="text-base leading-snug font-semibold break-words whitespace-normal sm:hidden">
          {titulo}
        </h1>
        <div className="hidden items-center gap-2 sm:flex">{acoes}</div>
      </div>
      <SeloDosDados className="-mt-2" />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_1fr]">
        <div className="rounded-lg border border-l-[5px] border-border/70 border-l-kpi-positive bg-card p-4">
          <div className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Total do recorte
          </div>
          <div className="mt-1 text-3xl font-bold text-kpi-positive tabular-nums">
            {lista.isLoading ? "…" : total.toLocaleString("pt-BR")}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">CTRCs · {periodo.rotulo}</div>
        </div>
        <div
          className={`grid grid-cols-1 gap-3 ${mostrarFaixa ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
        >
          <GraficoDeBarras
            titulo="Ocorrências"
            subtitulo="Distribuição por código · clique para filtrar"
            vazio="Sem ocorrências no recorte atual."
            larguraDoRotulo={44}
            barras={porCodigo.map((a) => ({
              chave: String(a.codigo),
              rotulo: `#${a.codigo}`,
              qtd: a.qtd,
              dica: `#${a.codigo} — ${a.descricao ?? ""}`,
              ativa: busca.codigos.includes(a.codigo),
            }))}
            aoClicar={(chave) => {
              const codigo = Number(chave);
              const so = busca.codigos.length === 1 && busca.codigos[0] === codigo;
              atualizarBusca({ codigos: so ? [] : [codigo] });
            }}
          />
          <GraficoDeBarras
            titulo="Distribuição por Unidade"
            subtitulo="Clique para filtrar por unidade"
            vazio="Sem dados de unidade no recorte."
            larguraDoRotulo={44}
            barras={porUnidade.map((a) => ({
              chave: a.unidade,
              rotulo: a.unidade,
              qtd: a.qtd,
              dica: a.unidade,
              ativa: busca.unidades.includes(a.unidade),
            }))}
            aoClicar={(unidade) => {
              const so = busca.unidades.length === 1 && busca.unidades[0] === unidade;
              atualizarBusca({ unidades: so ? [] : [unidade] });
            }}
          />
          <GraficoDeBarras
            titulo="Cidades Destino"
            subtitulo="Top 10 · clique para filtrar"
            vazio="Sem cidade de destino no recorte."
            larguraDoRotulo={96}
            barras={porCidade.map((a) => ({
              chave: a.cidade,
              rotulo: a.cidade,
              qtd: a.qtd,
              dica: a.cidade,
              ativa: busca.cidade === a.cidade,
            }))}
            aoClicar={(cidade) => {
              atualizarBusca({ cidade: busca.cidade === cidade ? "" : cidade });
            }}
          />
          {mostrarFaixa && (
            <GraficoDeBarras
              titulo="Dias de Atraso"
              subtitulo="Clique para filtrar por faixa"
              vazio="Sem atrasos no recorte."
              larguraDoRotulo={78}
              barras={porFaixa.map((a) => ({
                chave: a.faixa,
                rotulo: a.faixa,
                qtd: a.qtd,
                dica: a.faixa,
                ativa: soPorFaixa
                  ? busca.faixa_min === a.min && busca.faixa_max === a.max
                  : busca.atraso_min === a.min && busca.atraso_max === a.max,
              }))}
              aoClicar={(chave) => {
                const faixa = porFaixa.find((a) => a.faixa === chave);
                if (!faixa) return;
                if (soPorFaixa) {
                  const ativa = busca.faixa_min === faixa.min && busca.faixa_max === faixa.max;
                  atualizarBusca({
                    faixa_min: ativa ? null : faixa.min,
                    faixa_max: ativa ? null : faixa.max,
                  });
                  return;
                }
                // Estreita o atraso dentro do recorte atual (sem trocar de recorte, que perderia
                // o "só em aberto" de Atrasados/Sem movimento/Previstos).
                const ativa = busca.atraso_min === faixa.min && busca.atraso_max === faixa.max;
                atualizarBusca({
                  atraso_min: ativa ? null : faixa.min,
                  atraso_max: ativa ? null : faixa.max,
                });
              }}
            />
          )}
        </div>
      </div>

      <FiltrosAvancados
        ativos={filtrosAtivos}
        aoLimpar={() => {
          atualizarBusca(FILTROS_LIMPOS);
        }}
      >
        <FiltroPeriodo
          periodo={busca.periodo}
          de={busca.de}
          ate={busca.ate}
          rotulo={DATA_DA_BASE[busca.base]}
          aoMudar={(p) => {
            atualizarBusca(p);
          }}
        />
        <span className="inline-flex items-center gap-1 text-[11px] leading-none text-muted-foreground">
          <InfoTip texto={DICA_DA_BASE[busca.base]} />
          <span className="hidden sm:inline">{BASE_CURTA[busca.base]}</span>
        </span>
        <div className="flex rounded-md border border-border/70 p-0.5">
          {BASES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                atualizarBusca({ base: b });
              }}
              aria-pressed={busca.base === b}
              className={`rounded-[5px] px-2.5 py-1 text-[12px] ${
                busca.base === b
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {ROTULO_DA_BASE[b]}
            </button>
          ))}
        </div>
        <BuscaDocumento
          valor={busca.ctrc}
          placeholder="CTRC..."
          className="w-[150px]"
          aoMudar={(ctrc) => {
            atualizarBusca({ ctrc });
          }}
        />
        <BuscaDocumento
          valor={busca.nf}
          placeholder="Nota fiscal..."
          className="w-[150px]"
          aoMudar={(nf) => {
            atualizarBusca({ nf });
          }}
        />
        <SeletorDeFilial
          selecionadas={busca.filiais}
          aoMudar={(filiais) => {
            atualizarBusca({ filiais });
          }}
          contexto={contexto}
        />
        <SeletorDePagador
          rotulo="Parceiros"
          opcoes={pagadores.data ?? []}
          selecionados={busca.parceiros}
          aoMudar={(parceiros) => {
            atualizarBusca({ parceiros });
          }}
        />
        <SeletorDeTexto
          rotulo="Remetente"
          campo="remetente"
          valor={busca.remetente}
          aoMudar={(remetente) => {
            atualizarBusca({ remetente });
          }}
          contexto={contexto}
        />
        <SeletorDeTexto
          rotulo="Destino"
          campo="cidade_destino"
          valor={busca.destino}
          aoMudar={(destino) => {
            atualizarBusca({ destino });
          }}
          contexto={contexto}
        />
        {/* Ocorrência efetiva — também muda pelo clique no gráfico "Ocorrências". */}
        <SeletorDeOcorrencia
          filtro={filtro}
          selecionados={busca.codigos}
          nomeCurto={nomeCurto}
          aoMudar={(codigos) => {
            atualizarBusca({ codigos });
          }}
        />
        <MaisFiltros
          key={`${busca.cidade}|${busca.peso_min}|${busca.peso_max}|${busca.atraso_min}|${busca.atraso_max}`}
          busca={busca}
          ativo={maisFiltrosAtivos}
          aoMudar={atualizarBusca}
        />
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[11px] text-muted-foreground">Recorte</span>
          <SeletorDeRecorte
            rotulos={rotulosDosRecortes(nomeCurto)}
            selecionados={recortes}
            aoMudar={(marcados) => {
              const [tipo = "emitidos", ...extras] = marcados;
              // "Saíram para entrega" entra já filtrado nos códigos em aberto.
              const entrouSaiu =
                marcados.includes("nascido_atrasado") && !temRecorte("nascido_atrasado");
              atualizarBusca({
                tipo,
                recortes: extras.length > 0 ? extras : undefined,
                abertos: entrouSaiu || undefined,
              });
            }}
          />
        </div>
      </FiltrosAvancados>

      <FiltrandoPor etiquetas={etiquetas} />

      {lista.isError && (
        <div className="rounded-lg border border-status-bad/40 bg-status-bad-bg px-3 py-2 text-[12px] text-status-bad-fg">
          {mensagemAmigavel(lista.error)}
        </div>
      )}

      <TabelaCtrcs
        linhas={linhas}
        ordenacao={ordenacao}
        aoOrdenar={(ordem) => {
          const direcao = busca.sort === ordem && busca.dir === "desc" ? "asc" : "desc";
          atualizarBusca({ sort: ordem, dir: direcao });
        }}
        saiuComPrazoVencido={temRecorte("nascido_atrasado")}
      />

      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <div>
          Página {busca.page} de {totalDePaginas} · {total.toLocaleString("pt-BR")} CTRCs
        </div>
        <div className="flex items-center gap-1">
          <BotoesDePagina
            pagina={busca.page}
            totalDePaginas={totalDePaginas}
            aoMudar={(page) => {
              atualizarBusca({ page });
            }}
            desabilitado={lista.isLoading}
            className="h-7"
          />
        </div>
      </div>
    </div>
  );
}

/** Cidade, peso e atraso; cada campo aplica ao sair dele. */
function MaisFiltros({
  busca,
  ativo,
  aoMudar,
}: {
  busca: BuscaDaLista;
  ativo: boolean;
  aoMudar: (mudanca: Partial<BuscaDaLista>) => void;
}) {
  const campo = "w-full rounded-md border border-border/70 bg-background px-2 py-1 text-[12px]";
  const inteiroOuNulo = (texto: string) => {
    const n = numeroOuNulo(texto);
    return n === null ? null : Math.trunc(n);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card px-3 py-1 text-[12px] hover:bg-muted"
        >
          <Filter className="h-3 w-3" />
          Mais filtros
          {ativo && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              ativo
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3">
        <label className="block text-[11px] text-muted-foreground">
          Cidade destino contém
          <input
            defaultValue={busca.cidade}
            onBlur={(e) => {
              aoMudar({ cidade: e.target.value.trim() });
            }}
            placeholder="Ex.: Manaus"
            className={`mt-1 ${campo}`}
          />
        </label>
        <div>
          <span className="text-[11px] text-muted-foreground">Peso (kg)</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              aria-label="Peso mínimo"
              defaultValue={busca.peso_min ?? ""}
              onBlur={(e) => {
                aoMudar({ peso_min: numeroOuNulo(e.target.value) });
              }}
              placeholder="mín."
              className={campo}
            />
            <input
              type="number"
              aria-label="Peso máximo"
              defaultValue={busca.peso_max ?? ""}
              onBlur={(e) => {
                aoMudar({ peso_max: numeroOuNulo(e.target.value) });
              }}
              placeholder="máx."
              className={campo}
            />
          </div>
        </div>
        <div>
          <span className="text-[11px] text-muted-foreground">Atraso (dias)</span>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              aria-label="Atraso mínimo"
              defaultValue={busca.atraso_min ?? ""}
              onBlur={(e) => {
                aoMudar({ atraso_min: inteiroOuNulo(e.target.value) });
              }}
              placeholder="mín."
              className={campo}
            />
            <input
              type="number"
              aria-label="Atraso máximo"
              defaultValue={busca.atraso_max ?? ""}
              onBlur={(e) => {
                aoMudar({ atraso_max: inteiroOuNulo(e.target.value) });
              }}
              placeholder="máx."
              className={campo}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
