/**
 * Lista da aba Total: situação, "Em rota agora", status, busca, agrupamento, seleção para
 * exportar, tabela e paginação. Visual da tela de hoje (routes/_authenticated/romaneio.tsx).
 */
import {
  alertasDaLinha,
  atrasoDaLinha,
  entregueDaLinha,
  grupoDaLinha,
  type LimitesDeCarga,
  statusDaLinha,
} from "@erp/dominio/romaneio/linha";
import {
  AGRUPAMENTOS,
  type EntradaLista,
  type FiltrosRomaneio,
  LIMITE_AGRUPADO,
  type LinhaLista,
  type OrdemLista,
  TAMANHOS_DE_PAGINA,
} from "@erp/shared/contratos/romaneio";
import {
  formatarData,
  formatarDataHora,
  formatarInteiro,
  formatarMoeda,
  formatarPeso,
} from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  History,
  Layers,
  Truck,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { BotoesDePagina } from "@/componentes/comum/BotoesDePagina";
import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { type EtiquetaFiltroOpcional, FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { MensagemErro } from "@/componentes/comum/MensagemErro";
import { Painel } from "@/componentes/comum/Painel";
import { SeloStatus } from "@/componentes/comum/SeloStatus";
import { Checkbox } from "@/componentes/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { useAbrirCte } from "@/hooks/use-abrir-cte";
import { cn } from "@/lib/utils";

import { consultaLinhaDoTempo, consultaLista, exportarLista } from "./api";
import {
  type BuscaRomaneio,
  recorteEfetivo,
  RECORTES_DA_LISTA,
  ROTULO_AGRUPAMENTO,
  ROTULO_EM_ROTA_AGORA,
  ROTULO_RECORTE,
  tamanhoDePagina,
  veTodos,
} from "./busca";
import {
  Cabecalho,
  CampoAdiado,
  CLASSE_CODIGO,
  CLASSE_NUMERO,
  EstadoDaTabela,
  propsDaLinha,
  SeletorDaLista,
  TabelaPropria,
  Th,
} from "./componentes";
import {
  alternarLinha,
  alternarTodas,
  cidadeUf,
  COLUNAS_DA_LISTA,
  estadoDoCabecalho,
  estaMarcada,
  linhaParaExportar,
  proximaOrdem,
  quantasMarcadas,
  type Selecao,
  selecaoInicial,
  situacaoDe,
} from "./lista";

/** Total de colunas da tabela; as 18 primeiras vêm antes de Peso (subtotal do grupo). */
const COLUNAS_DA_TABELA = 24;
const COLUNAS_ANTES_DO_PESO = 18;

const ETIQUETA_EM_ROTA_AGORA = { sim: "só em rota agora", nao: "só fora de rota agora" } as const;

interface PropsDaLista {
  busca: BuscaRomaneio;
  definir: (mudanca: Partial<BuscaRomaneio>) => void;
  filtros: FiltrosRomaneio;
  otifVisivel: boolean;
}

export function ListaTotal({ busca: b, definir, filtros, otifVisivel }: PropsDaLista) {
  const abrirCte = useAbrirCte();
  const recorte = recorteEfetivo(b);
  const daLista = {
    recorte,
    emRotaAgora: b.romaneado,
    status: b.status,
    semMovimento: b.semMovimento,
    ...(b.ctrc ? { ctrc: b.ctrc } : {}),
    ...(b.nf ? { nf: b.nf } : {}),
    ...(b.busca.trim() ? { busca: b.busca.trim() } : {}),
  } satisfies Partial<EntradaLista>;
  const entrada: EntradaLista = {
    filtros,
    ...daLista,
    agrupar: b.agrupar,
    ...(b.ordem ? { ordem: b.ordem } : {}),
    direcao: b.dir,
    pagina: b.page,
    tamanho: tamanhoDePagina(b.size),
  };
  const q = useQuery(consultaLista(entrada));
  const linhas = useMemo(() => q.data?.linhas ?? [], [q.data]);
  const total = q.data?.total ?? 0;
  const limites = q.data?.limites ?? {
    pesoKg: Number.POSITIVE_INFINITY,
    volumes: Number.POSITIVE_INFINITY,
  };
  const hoje = q.data?.hoje ?? "";

  // Seleção para exportar: volta para "todas" quando qualquer filtro da lista muda.
  const chaveDosFiltros = JSON.stringify({ filtros, daLista });
  const [selecaoGuardada, setSelecao] = useState<Selecao>(() => selecaoInicial(chaveDosFiltros));
  const selecao =
    selecaoGuardada.chave === chaveDosFiltros ? selecaoGuardada : selecaoInicial(chaveDosFiltros);
  const marcadas = quantasMarcadas(selecao, total);
  const cabecalho = estadoDoCabecalho(selecao);

  const agrupadas = useMemo(() => {
    if (b.agrupar === "none") return null;
    const agrupar = b.agrupar;
    const grupos = new Map<string, { rotulo: string; linhas: LinhaLista[] }>();
    for (const l of linhas) {
      const g = grupoDaLinha(agrupar, l);
      const atual = grupos.get(g.chave);
      if (atual) atual.linhas.push(l);
      else grupos.set(g.chave, { rotulo: g.rotulo, linhas: [l] });
    }
    const subtotais = q.data?.grupos ?? [];
    return [...grupos].map(([chave, g]) => ({
      chave,
      ...g,
      subtotal: subtotais.find((s) => s.chave === chave) ?? null,
    }));
  }, [b.agrupar, linhas, q.data?.grupos]);

  const totalDePaginas = Math.max(1, Math.ceil(total / b.size));
  const ordenar = (coluna: OrdemLista) => {
    definir({ ...proximaOrdem(b, coluna), page: 1 });
  };
  const ordem = { ordem: b.ordem, dir: b.dir, aoOrdenar: ordenar };

  const etiquetas: EtiquetaFiltroOpcional[] = [
    b.recorte !== "todos" && {
      rotulo: "Situação",
      valor: ROTULO_RECORTE[b.recorte],
      limpar: () => {
        definir({ recorte: "todos", page: 1 });
      },
    },
    b.romaneado !== "todos" && {
      rotulo: "Em rota agora",
      valor: ETIQUETA_EM_ROTA_AGORA[b.romaneado],
      limpar: () => {
        definir({ romaneado: "todos", page: 1 });
      },
    },
    b.status === "andamento" && {
      rotulo: "Status",
      valor: "Só em andamento",
      limpar: () => {
        definir({ status: "todos", page: 1 });
      },
    },
    b.busca.trim() && {
      rotulo: "Busca",
      valor: b.busca.trim(),
      limpar: () => {
        definir({ busca: "", page: 1 });
      },
    },
  ];

  const carregarParaExportar = async () => {
    const r = await exportarLista({
      filtros,
      ...daLista,
      selecao: { modo: selecao.modo, ids: [...selecao.ids] },
    });
    return r.linhas.map((l) => linhaParaExportar(l, r.hoje, r.limites));
  };

  const vazio = b.previsao
    ? `Nenhum CTRC com data prevista de entrega em ${formatarData(b.previsao)}. O prazo pode ainda não ter sido calculado pelo SSW.`
    : "Nenhum CTRC para os filtros selecionados. Tente ampliar o período ou ajustar os filtros.";

  return (
    <Painel
      barra={
        <div className="flex w-full flex-col gap-2.5">
          {/* Os mesmos recortes dos cards: clicar num card marca a Situação; mudar aqui é igual. */}
          <div className="flex flex-wrap items-center gap-2">
            <SeletorDaLista
              rotulo="Situação"
              valor={b.recorte}
              aoMudar={(recorte) => {
                definir({ recorte, page: 1 });
              }}
              opcoes={RECORTES_DA_LISTA.filter(
                (r) => (veTodos(b) || r !== "parado") && (otifVisivel || r !== "otif"),
              ).map((r) => ({ valor: r, rotulo: r === "todos" ? "Todas" : ROTULO_RECORTE[r] }))}
            />
            <SeletorDaLista
              rotulo="Em rota agora"
              valor={b.romaneado}
              aoMudar={(romaneado) => {
                definir({ romaneado, page: 1 });
              }}
              opcoes={(["todos", "sim", "nao"] as const).map((r) => ({
                valor: r,
                rotulo: ROTULO_EM_ROTA_AGORA[r],
              }))}
            />
            <SeletorDaLista
              rotulo="Status"
              valor={b.status}
              aoMudar={(status) => {
                definir({ status, page: 1 });
              }}
              opcoes={[
                { valor: "todos", rotulo: "Todos" },
                { valor: "andamento", rotulo: "Só em andamento" },
              ]}
            />
            <CampoAdiado
              valor={b.busca}
              aoMudar={(busca) => {
                definir({ busca, page: 1 });
              }}
              placeholder="Buscar na lista: NF, CTRC, remetente, cidade, placa…"
              className="w-[340px] max-w-full"
            />
          </div>
          <FiltrandoPor etiquetas={etiquetas} />
          <div className="flex flex-wrap items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
            <SeletorDaLista
              rotulo="Agrupar por"
              valor={b.agrupar}
              aoMudar={(agrupar) => {
                definir({ agrupar, page: 1 });
              }}
              opcoes={AGRUPAMENTOS.map((g) => ({ valor: g, rotulo: ROTULO_AGRUPAMENTO[g] }))}
            />
            {b.agrupar !== "none" && (
              <SeloStatus tom="neutro" semIcone>
                paginação desativada (até {formatarInteiro(LIMITE_AGRUPADO)})
              </SeloStatus>
            )}
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {total > 0 && (
                <span className="text-[12.5px] text-muted-foreground">
                  {cabecalho === true ? (
                    <>todas as {formatarInteiro(total)} linhas marcadas para exportar</>
                  ) : (
                    <>
                      {formatarInteiro(marcadas)} de {formatarInteiro(total)} marcadas para exportar
                      ·{" "}
                      <button
                        type="button"
                        className="font-medium text-brand underline-offset-2 hover:underline"
                        onClick={() => {
                          setSelecao(selecaoInicial(chaveDosFiltros));
                        }}
                      >
                        marcar todas
                      </button>
                    </>
                  )}
                </span>
              )}
              <ExportMenu
                arquivo="romaneio"
                titulo="Romaneio"
                subtitulo={`${formatarData(filtros.inicio)} a ${formatarData(filtros.fim)}`}
                colunas={COLUNAS_DA_LISTA}
                linhas={[]}
                carregarLinhas={carregarParaExportar}
                orientacao="paisagem"
                tamanhoFonte={5.5}
                desabilitado={q.isLoading || (total > 0 && marcadas === 0)}
              />
            </div>
          </div>
        </div>
      }
      rodape={
        b.agrupar === "none" && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <SeletorDaLista
              rotulo="Linhas por página"
              valor={String(b.size)}
              padrao="50"
              aoMudar={(size) => {
                definir({ size: tamanhoDePagina(Number(size)), page: 1 });
              }}
              opcoes={TAMANHOS_DE_PAGINA.map((t) => ({ valor: String(t), rotulo: String(t) }))}
            />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground" aria-live="polite">
                Página {b.page} de {totalDePaginas}
              </span>
              <BotoesDePagina
                pagina={b.page}
                totalDePaginas={totalDePaginas}
                aoMudar={(page) => {
                  definir({ page });
                }}
              />
            </div>
          </div>
        )
      }
    >
      <TabelaPropria>
        <Cabecalho>
          <ThOrdenavel
            coluna="numero_nf"
            rotulo="NF"
            {...ordem}
            fixa
            antes={
              <Checkbox
                checked={cabecalho}
                onCheckedChange={() => {
                  setSelecao(alternarTodas(selecao));
                }}
                disabled={linhas.length === 0}
                aria-label="Marcar ou desmarcar todas as linhas da lista"
                title="Marcar/desmarcar todas as linhas da lista (todas as páginas) — só as marcadas saem na exportação"
              />
            }
          />
          <ThOrdenavel coluna="numero_ctrc" rotulo="CTRC" {...ordem} />
          <Th>Status</Th>
          <ThOrdenavel coluna="data_emissao" rotulo="Emissão" {...ordem} />
          <ThOrdenavel coluna="data_embarque" rotulo="Embarque" {...ordem} />
          <Th>Prazo</Th>
          <ThOrdenavel coluna="parceiro" rotulo="Parceiro" {...ordem} />
          <ThOrdenavel coluna="unidade" rotulo="Unidade" {...ordem} />
          <Th>Cidade Unid.</Th>
          <Th>Local. atual</Th>
          <Th>Placa</Th>
          <Th>Motorista</Th>
          <ThOrdenavel coluna="remetente" rotulo="Remetente" {...ordem} />
          <Th>Cliente destino</Th>
          <ThOrdenavel coluna="cidade_destino" rotulo="Destino" {...ordem} />
          <Th>Setor</Th>
          <Th>Bairro</Th>
          <Th direita>Vlr. mercadoria</Th>
          <ThOrdenavel coluna="peso" rotulo="Peso" {...ordem} direita />
          <ThOrdenavel coluna="volumes" rotulo="Vol." {...ordem} direita />
          <ThOrdenavel coluna="valor_frete" rotulo="Frete" {...ordem} direita />
          <ThOrdenavel coluna="status_atual" rotulo="Última ocorrência" {...ordem} />
          <Th>Atraso</Th>
          <Th>Alertas</Th>
        </Cabecalho>
        <tbody>
          <EstadoDaTabela
            colunas={COLUNAS_DA_TABELA}
            carregando={q.isLoading}
            erro={q.error}
            aoTentarDeNovo={() => void q.refetch()}
            vazio={q.isSuccess && linhas.length === 0}
            mensagem={vazio}
          />
          {linhas.length > 0 && linhas.every((l) => l.dataPrevista === null) && (
            <tr>
              <td
                colSpan={COLUNAS_DA_TABELA}
                className="border-b border-border bg-muted/40 px-4 py-2 text-center text-[12.5px] text-muted-foreground"
              >
                Prazos ainda não calculados pelo SSW para as notas abaixo.
              </td>
            </tr>
          )}
          {agrupadas === null
            ? linhas.map((l) => (
                <Linha
                  key={l.id}
                  linha={l}
                  hoje={hoje}
                  limites={limites}
                  aoAbrir={() => {
                    abrirCte(l.numero);
                  }}
                  marcada={estaMarcada(selecao, l.id)}
                  aoMarcar={() => {
                    setSelecao(alternarLinha(selecao, l.id));
                  }}
                />
              ))
            : agrupadas.map((g) => (
                <Grupo key={g.chave} rotulo={g.rotulo} linhas={g.linhas} subtotal={g.subtotal}>
                  {(l) => (
                    <Linha
                      key={l.id}
                      linha={l}
                      hoje={hoje}
                      limites={limites}
                      aoAbrir={() => {
                        abrirCte(l.numero);
                      }}
                      marcada={estaMarcada(selecao, l.id)}
                      aoMarcar={() => {
                        setSelecao(alternarLinha(selecao, l.id));
                      }}
                    />
                  )}
                </Grupo>
              ))}
        </tbody>
      </TabelaPropria>
    </Painel>
  );
}

// ---------------------------------------------------------------------------------------------

/** Cabeçalho que ordena a lista no servidor (mesmo visual dos outros cabeçalhos). */
function ThOrdenavel({
  coluna,
  rotulo,
  ordem,
  dir,
  aoOrdenar,
  direita,
  fixa,
  antes,
}: {
  coluna: OrdemLista;
  rotulo: string;
  ordem: OrdemLista | undefined;
  dir: "asc" | "desc";
  aoOrdenar: (c: OrdemLista) => void;
  direita?: boolean;
  fixa?: boolean;
  /** Antes do rótulo (a caixa de seleção da coluna fixa). */
  antes?: ReactNode;
}) {
  const ativa = ordem === coluna;
  const Icone = ativa ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      scope="col"
      aria-sort={ativa ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "px-4 py-2.5 text-left text-[11.5px] font-semibold tracking-[0.04em] whitespace-nowrap uppercase",
        direita && "text-right",
        fixa && "sticky left-0 z-10 bg-muted",
      )}
    >
      {antes ? <span className="mr-2 inline-flex align-middle normal-case">{antes}</span> : null}
      <button
        type="button"
        onClick={() => {
          aoOrdenar(coluna);
        }}
        className={cn(
          "inline-flex items-center gap-0.5 uppercase hover:text-foreground",
          ativa && "text-foreground",
        )}
      >
        {rotulo}
        <Icone className={cn("ml-1 h-3 w-3", !ativa && "opacity-50")} aria-hidden />
      </button>
    </th>
  );
}

const ROTULO_FONTE = {
  bi2_0174: "BI2 0174 (movimentação)",
  bi2_0013: "BI2 0013 (posição)",
  webhook: "Webhook SSW",
} as const;

/** Status único por linha, do mais avançado para o menos (mesma regra da exportação). */
function SeloDeStatus({ linha }: { linha: LinhaLista }) {
  const status = statusDaLinha(situacaoDe(linha));
  switch (status) {
    case "Entregue":
      return <SeloStatus tom="sucesso">Entregue</SeloStatus>;
    case "Baixado":
      return (
        <span
          title={
            linha.ultimaOcorrencia
              ? `Encerrado por baixa formal (código ${linha.ultimaOcorrencia.codigo})`
              : "Encerrado por baixa formal"
          }
        >
          <SeloStatus tom="alerta">Baixado</SeloStatus>
        </span>
      );
    case "Em rota":
      return (
        <SeloStatus tom="info" icone={Truck}>
          Em rota
        </SeloStatus>
      );
    case "Pendente":
      return <SeloStatus tom="neutro">Pendente</SeloStatus>;
  }
}

/** Selo de um alerta da linha (atraso, responsabilidade do cliente, TDE, peso/volume). */
function SeloDoAlerta({
  alerta,
  fonte,
  tde,
}: {
  alerta: string;
  fonte: string;
  tde: number | null;
}) {
  if (alerta.startsWith("ATRASADO")) {
    return (
      <span title={`fonte: ${fonte}`}>
        <SeloStatus tom="erro">{alerta}</SeloStatus>
      </span>
    );
  }
  if (alerta === "TDE") {
    return (
      <span title={`TDE (taxa de dificuldade de entrega): ${formatarMoeda(tde)}`}>
        <SeloStatus tom="alerta" semIcone>
          TDE
        </SeloStatus>
      </span>
    );
  }
  return (
    <SeloStatus tom="neutro" semIcone>
      {alerta}
    </SeloStatus>
  );
}

const diasPorExtenso = (dias: number) => `${dias} ${dias === 1 ? "dia" : "dias"}`;

function Linha({
  linha: l,
  hoje,
  limites,
  aoAbrir,
  marcada,
  aoMarcar,
}: {
  linha: LinhaLista;
  hoje: string;
  limites: LimitesDeCarga;
  aoAbrir: () => void;
  marcada: boolean;
  aoMarcar: () => void;
}) {
  const situacao = situacaoDe(l);
  const atraso = atrasoDaLinha(situacao, hoje);
  const alertas = alertasDaLinha(situacao, atraso.dias, limites);
  const atrasada = atraso.dias > 0;
  const o = l.ultimaOcorrencia;
  const fundo = atrasada ? "bg-status-bad-bg" : "bg-card";
  return (
    <tr
      {...propsDaLinha(
        aoAbrir,
        cn("group", atrasada && "bg-status-bad-bg text-status-bad-fg hover:bg-status-bad-bg/70"),
      )}
    >
      <td
        className={cn(
          "sticky left-0 z-[5] px-4 py-2.5 whitespace-nowrap",
          fundo,
          !atrasada && "group-hover:bg-muted",
        )}
      >
        {/* A caixa de seleção não abre o CTRC. */}
        <span
          className="mr-2 inline-flex align-middle"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Checkbox
            checked={marcada}
            onCheckedChange={aoMarcar}
            aria-label={`Marcar NF ${l.numeroNf ?? l.numero} para exportação`}
          />
        </span>
        {l.numeroNf !== null ? (
          <span className="font-mono text-[12px] font-semibold text-brand">{l.numeroNf}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className={cn(CLASSE_CODIGO, !atrasada && "text-muted-foreground")}>{l.numero}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <SeloDeStatus linha={l} />
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">{formatarData(l.dataEmissao)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">{formatarData(l.dataEmbarque)}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">{formatarData(l.dataPrevista)}</td>
      <td className="max-w-[180px] truncate px-4 py-2.5">{l.parceiroNome ?? "—"}</td>
      <td className={cn(CLASSE_CODIGO, !atrasada && "text-muted-foreground")}>{l.filial ?? "—"}</td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {cidadeUf(l.unidadeCidade, l.unidadeUf) ?? "—"}
      </td>
      <td className={cn(CLASSE_CODIGO, !atrasada && "text-muted-foreground")}>
        {l.unidadeAtual ?? "—"}
      </td>
      <td className={CLASSE_CODIGO}>{l.placa ?? "—"}</td>
      <td className="max-w-[160px] truncate px-4 py-2.5">{l.motorista ?? "—"}</td>
      <td className="max-w-[200px] truncate px-4 py-2.5">{l.remetente ?? "—"}</td>
      <td className="max-w-[200px] truncate px-4 py-2.5" title={l.destinatario ?? undefined}>
        {l.destinatario ?? "—"}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        {cidadeUf(l.cidadeDestino, l.ufDestino) ?? "—"}
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">{l.setor ?? "—"}</td>
      <td className="max-w-[160px] truncate px-4 py-2.5" title={l.endereco ?? undefined}>
        {l.bairro ?? "—"}
      </td>
      <td className={CLASSE_NUMERO}>{formatarMoeda(l.valorMercadoria)}</td>
      <td className={CLASSE_NUMERO}>{formatarPeso(l.peso, { fixas: true })}</td>
      <td className={CLASSE_NUMERO}>{l.volumes === null ? "—" : formatarInteiro(l.volumes)}</td>
      <td className={CLASSE_NUMERO}>{formatarMoeda(l.valorFrete)}</td>
      <td
        className={cn("px-4 py-2.5", !atrasada && "text-muted-foreground")}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="flex items-center gap-1">
          {o?.descricao ? (
            <span
              title={[
                `Código ${o.codigo}`,
                o.dataHora ? formatarDataHora(o.dataHora) : null,
                o.fonte ? `Fonte: ${ROTULO_FONTE[o.fonte]}` : null,
              ]
                .filter((t) => t !== null)
                .join(" · ")}
            >
              {o.descricao}
            </span>
          ) : (
            (l.statusAtual ?? "—")
          )}
          <LinhaDoTempo sigla={l.sigla} numero={l.numero} />
        </div>
      </td>
      <td className="px-4 py-2.5 whitespace-nowrap">
        <Atraso linha={l} dias={atraso.dias} fonte={atraso.fonte} />
      </td>
      <td className="px-4 py-2.5">
        <div className="flex flex-wrap gap-1">
          {alertas.map((a) => (
            <SeloDoAlerta key={a} alerta={a} fonte={atraso.fonte} tde={l.tde} />
          ))}
        </div>
      </td>
    </tr>
  );
}

function Atraso({ linha: l, dias, fonte }: { linha: LinhaLista; dias: number; fonte: string }) {
  if (l.baixadoSemEntrega) {
    return (
      <span className="text-muted-foreground" title="Encerrado por baixa formal">
        —
      </span>
    );
  }
  if (l.responsabilidadeCliente) {
    return (
      <SeloStatus tom="neutro" semIcone>
        Resp. cliente
      </SeloStatus>
    );
  }
  if (dias > 0) {
    return (
      <span className="font-semibold text-status-bad-fg" title={`fonte: ${fonte}`}>
        {diasPorExtenso(dias)}
      </span>
    );
  }
  if (entregueDaLinha(situacaoDe(l))) {
    return l.performanceDias === null ? (
      <span className="text-muted-foreground" title="Aguardando dados do BI2">
        —
      </span>
    ) : (
      <span className="font-semibold text-status-good-fg">No prazo</span>
    );
  }
  return (
    <span className="text-muted-foreground" title="Em trânsito, dentro do prazo previsto">
      —
    </span>
  );
}

function Grupo({
  rotulo,
  linhas,
  subtotal,
  children,
}: {
  rotulo: string;
  linhas: readonly LinhaLista[];
  subtotal: { ctes: number; peso: number; volumes: number; frete: number } | null;
  children: (l: LinhaLista) => ReactNode;
}) {
  const [aberto, setAberto] = useState(true);
  const soma = subtotal ?? {
    ctes: linhas.length,
    peso: linhas.reduce((s, l) => s + (l.peso ?? 0), 0),
    volumes: linhas.reduce((s, l) => s + (l.volumes ?? 0), 0),
    frete: linhas.reduce((s, l) => s + (l.valorFrete ?? 0), 0),
  };
  const Seta = aberto ? ChevronDown : ChevronRight;
  return (
    <>
      <tr className="border-y border-border bg-muted/60">
        <td colSpan={COLUNAS_ANTES_DO_PESO} className="sticky left-0 z-[5] px-4 py-2">
          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => {
              setAberto((a) => !a);
            }}
            className="inline-flex items-center gap-1.5 font-semibold"
          >
            <Seta className="h-4 w-4" aria-hidden />
            {rotulo}
            <span className="ml-2 text-[12.5px] font-normal text-muted-foreground">
              {formatarInteiro(soma.ctes)} notas
            </span>
          </button>
        </td>
        <td className={cn(CLASSE_NUMERO, "py-2 font-semibold")}>
          {formatarPeso(soma.peso, { fixas: true })}
        </td>
        <td className={cn(CLASSE_NUMERO, "py-2 font-semibold")}>{formatarInteiro(soma.volumes)}</td>
        <td className={cn(CLASSE_NUMERO, "py-2 font-semibold")}>{formatarMoeda(soma.frete)}</td>
        <td colSpan={COLUNAS_DA_TABELA - COLUNAS_ANTES_DO_PESO - 3} />
      </tr>
      {aberto && linhas.map((l) => children(l))}
    </>
  );
}

/** Linha do tempo de ocorrências do CT-e (sistema + importações do SSW). */
function LinhaDoTempo({ sigla, numero }: { sigla: string; numero: string }) {
  const [aberto, setAberto] = useState(false);
  const q = useQuery({ ...consultaLinhaDoTempo(sigla, numero), enabled: aberto });
  const eventos = q.data ?? [];
  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Ver linha do tempo de ocorrências"
          aria-label={`Linha do tempo do CTRC ${numero}`}
        >
          <History className="h-3.5 w-3.5" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-0">
        <div className="border-b border-border px-4 py-2.5 text-[13px] font-semibold">
          Linha do tempo · {numero}
        </div>
        <div className="rolagem-fina max-h-[320px] overflow-y-auto p-4">
          {q.isLoading && <div className="text-[13px] text-muted-foreground">Carregando…</div>}
          {q.isError && <MensagemErro erro={q.error} className="py-2" />}
          {q.isSuccess && eventos.length === 0 && (
            <div className="text-[13px] text-muted-foreground">Sem ocorrências registradas.</div>
          )}
          <ol className="space-y-3">
            {eventos.map((e, i) => (
              <li key={i} className="border-l-2 border-brand/40 pl-3 text-[13px]">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="tabular-nums">{formatarDataHora(e.dataHora)}</span>
                  {e.codigo && (
                    <SeloStatus tom="neutro" semIcone className="h-5">
                      {e.codigo}
                    </SeloStatus>
                  )}
                  <span className="ml-auto">{e.fonte === "ssw" ? "SSW" : "sistema"}</span>
                </div>
                <div className="text-foreground">{e.descricao ?? "—"}</div>
                {e.complemento && (
                  <div className="text-[12px] text-muted-foreground">{e.complemento}</div>
                )}
                {(e.unidade ?? e.usuario) && (
                  <div className="text-[12px] text-muted-foreground">
                    {[e.unidade, e.usuario].filter((t) => t !== null).join(" · ")}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      </PopoverContent>
    </Popover>
  );
}
