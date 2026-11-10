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
import { formatarData, formatarDataHora } from "@erp/shared/formatacao";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  History,
  Layers,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { ExportMenu } from "@/componentes/comum/ExportMenu";
import { type EtiquetaFiltroOpcional, FiltrandoPor } from "@/componentes/comum/FiltrosAvancados";
import { Badge } from "@/componentes/ui/badge";
import { Button } from "@/componentes/ui/button";
import { Checkbox } from "@/componentes/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { mensagemAmigavel } from "@/lib/mensagem-de-erro";
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
import { CampoAdiado, SelectLista } from "./componentes";
import { fmtMoeda, fmtPeso, nfInt } from "./formatos";
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
import { useAbrirCte } from "./navegacao";

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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-[10px] border border-b-0 border-border/70 bg-card px-3 py-2">
        {/* Os mesmos recortes dos cards: clicar num card marca a Situação; mudar aqui é igual. */}
        <div className="flex w-full flex-wrap items-center gap-2 border-b border-border/60 pb-2 text-[12px] text-muted-foreground">
          <SelectLista
            rotulo="Situação"
            valor={b.recorte}
            aoMudar={(recorte) => {
              definir({ recorte, page: 1 });
            }}
            opcoes={RECORTES_DA_LISTA.filter(
              (r) => (veTodos(b) || r !== "parado") && (otifVisivel || r !== "otif"),
            ).map((r) => ({ valor: r, rotulo: r === "todos" ? "Todas" : ROTULO_RECORTE[r] }))}
          />
          <SelectLista
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
          <SelectLista
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
            className="w-[320px] max-w-full"
          />
        </div>
        <FiltrandoPor className="w-full" etiquetas={etiquetas} />
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Agrupar por:
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[12px]">
                {ROTULO_AGRUPAMENTO[b.agrupar]} <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {AGRUPAMENTOS.map((g) => (
                <DropdownMenuItem
                  key={g}
                  onSelect={() => {
                    definir({ agrupar: g, page: 1 });
                  }}
                >
                  {ROTULO_AGRUPAMENTO[g]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {b.agrupar !== "none" && (
            <Badge variant="secondary" className="text-[10px]">
              paginação desativada (até {nfInt.format(LIMITE_AGRUPADO)})
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {cabecalho === true ? (
                <>todas as {nfInt.format(total)} linhas marcadas para exportar</>
              ) : (
                <>
                  {nfInt.format(marcadas)} de {nfInt.format(total)} marcadas para exportar ·{" "}
                  <button
                    type="button"
                    className="text-[var(--brand)] underline-offset-2 hover:underline"
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

      <div className="overflow-hidden rounded-b-[10px] border border-border/70 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr className="border-b border-border/70">
                <Th
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
                <Th coluna="numero_ctrc" rotulo="CTRC" {...ordem} />
                <ThSimples>Status</ThSimples>
                <Th coluna="data_emissao" rotulo="Emissão" {...ordem} />
                <Th coluna="data_embarque" rotulo="Embarque" {...ordem} />
                <ThSimples>Prazo</ThSimples>
                <Th coluna="parceiro" rotulo="Parceiro" {...ordem} />
                <Th coluna="unidade" rotulo="Unidade" {...ordem} />
                <ThSimples>Cidade Unid.</ThSimples>
                <ThSimples>Local. atual</ThSimples>
                <ThSimples>Placa</ThSimples>
                <ThSimples>Motorista</ThSimples>
                <Th coluna="remetente" rotulo="Remetente" {...ordem} />
                <ThSimples>Cliente destino</ThSimples>
                <Th coluna="cidade_destino" rotulo="Destino" {...ordem} />
                <ThSimples>Setor</ThSimples>
                <ThSimples>Bairro</ThSimples>
                <ThSimples direita>Vlr. mercadoria</ThSimples>
                <Th coluna="peso" rotulo="Peso" {...ordem} direita />
                <Th coluna="volumes" rotulo="Vol." {...ordem} direita />
                <Th coluna="valor_frete" rotulo="Frete" {...ordem} direita />
                <Th coluna="status_atual" rotulo="Última ocorrência" {...ordem} />
                <ThSimples>Atraso</ThSimples>
                <ThSimples>Alertas</ThSimples>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <LinhasCarregando />}
              {q.isError && (
                <tr>
                  <td colSpan={COLUNAS_DA_TABELA} className="px-3 py-8 text-center">
                    <div className="text-destructive">{mensagemAmigavel(q.error)}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => void q.refetch()}
                    >
                      Tentar novamente
                    </Button>
                  </td>
                </tr>
              )}
              {q.isSuccess && linhas.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUNAS_DA_TABELA}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    {vazio}
                  </td>
                </tr>
              )}
              {linhas.length > 0 && linhas.every((l) => l.dataPrevista === null) && (
                <tr>
                  <td
                    colSpan={COLUNAS_DA_TABELA}
                    className="border-b border-border/40 bg-muted/20 px-3 py-2 text-center text-[11px] text-muted-foreground"
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
          </table>
        </div>

        {b.agrupar === "none" && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-[12px]">
            <label className="flex items-center gap-2 text-muted-foreground">
              <span>Linhas por página:</span>
              <select
                className="rounded border border-border/70 bg-background px-1 py-0.5 text-[12px]"
                value={b.size}
                onChange={(e) => {
                  definir({ size: tamanhoDePagina(Number(e.target.value)), page: 1 });
                }}
              >
                {TAMANHOS_DE_PAGINA.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                Página {b.page} de {totalDePaginas}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={b.page <= 1}
                onClick={() => {
                  definir({ page: Math.max(1, b.page - 1) });
                }}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                disabled={b.page >= totalDePaginas}
                onClick={() => {
                  definir({ page: Math.min(totalDePaginas, b.page + 1) });
                }}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ThSimples({ children, direita }: { children: ReactNode; direita?: boolean }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-3 py-1.5 font-normal",
        direita ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Th({
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
      aria-sort={ativa ? (dir === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "whitespace-nowrap px-3 py-1.5 text-left font-normal",
        direita && "text-right",
        fixa && "sticky left-0 z-10 bg-muted/40",
      )}
    >
      {antes ? <span className="mr-2 inline-flex align-middle">{antes}</span> : null}
      <button
        type="button"
        onClick={() => {
          aoOrdenar(coluna);
        }}
        className={cn("inline-flex items-center gap-1", ativa && "text-foreground")}
      >
        {rotulo} <Icone className="h-3 w-3 opacity-60" />
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
      return (
        <Badge
          variant="secondary"
          className="border-emerald-600/30 bg-emerald-600/10 text-[10px] text-emerald-700"
        >
          Entregue
        </Badge>
      );
    case "Baixado":
      return (
        <Badge
          variant="secondary"
          className="border-amber-600/30 bg-amber-600/10 text-[10px] text-amber-700"
          title={
            linha.ultimaOcorrencia
              ? `Encerrado por baixa formal (código ${linha.ultimaOcorrencia.codigo})`
              : "Encerrado por baixa formal"
          }
        >
          Baixado
        </Badge>
      );
    case "Em rota":
      return (
        <Badge
          variant="secondary"
          className="border-sky-600/30 bg-sky-600/10 text-[10px] text-sky-700"
        >
          Em rota
        </Badge>
      );
    case "Pendente":
      return (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          Pendente
        </Badge>
      );
  }
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
  return (
    <tr
      onClick={aoAbrir}
      className={cn(
        "cursor-pointer border-b border-border/40 last:border-0 hover:bg-muted/40",
        atrasada && "bg-destructive/10 text-destructive hover:bg-destructive/15",
      )}
    >
      <td
        className={cn(
          "sticky left-0 z-[5] whitespace-nowrap px-3 py-1 hover:bg-muted/40",
          atrasada ? "bg-destructive/10 text-destructive" : "bg-card",
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
          <span className="font-mono text-[11px] font-medium text-[var(--brand)]">
            {l.numeroNf}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-1 font-mono text-[11px] text-muted-foreground">
        {l.numero}
      </td>
      <td className="whitespace-nowrap px-3 py-1">
        <SeloDeStatus linha={l} />
      </td>
      <td className="whitespace-nowrap px-3 py-1">{formatarData(l.dataEmissao)}</td>
      <td className="whitespace-nowrap px-3 py-1">{formatarData(l.dataEmbarque)}</td>
      <td className="whitespace-nowrap px-3 py-1">{formatarData(l.dataPrevista)}</td>
      <td className="max-w-[180px] truncate px-3 py-1">{l.parceiroNome ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-1 font-mono text-[11px] text-muted-foreground">
        {l.filial ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-1">
        {cidadeUf(l.unidadeCidade, l.unidadeUf) ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-1 font-mono text-[11px] text-muted-foreground">
        {l.unidadeAtual ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-1 font-mono text-[11px]">{l.placa ?? "—"}</td>
      <td className="max-w-[160px] truncate px-3 py-1">{l.motorista ?? "—"}</td>
      <td className="max-w-[200px] truncate px-3 py-1">{l.remetente ?? "—"}</td>
      <td className="max-w-[200px] truncate px-3 py-1" title={l.destinatario ?? undefined}>
        {l.destinatario ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-1">
        {cidadeUf(l.cidadeDestino, l.ufDestino) ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-1">{l.setor ?? "—"}</td>
      <td className="max-w-[160px] truncate px-3 py-1" title={l.endereco ?? undefined}>
        {l.bairro ?? "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-1 text-right tabular-nums">
        {fmtMoeda(l.valorMercadoria)}
      </td>
      <td className="whitespace-nowrap px-3 py-1 text-right tabular-nums">{fmtPeso(l.peso)}</td>
      <td className="px-3 py-1 text-right tabular-nums">
        {l.volumes === null ? "—" : nfInt.format(l.volumes)}
      </td>
      <td className="whitespace-nowrap px-3 py-1 text-right tabular-nums">
        {fmtMoeda(l.valorFrete)}
      </td>
      <td
        className="px-3 py-1 text-muted-foreground"
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
      <td className="whitespace-nowrap px-3 py-1">
        <Atraso linha={l} dias={atraso.dias} fonte={atraso.fonte} />
      </td>
      <td className="px-3 py-1">
        <div className="flex flex-wrap gap-1">
          {alertas.map((a) =>
            a.startsWith("ATRASADO") ? (
              <Badge
                key={a}
                variant="destructive"
                className="text-[10px]"
                title={`fonte: ${atraso.fonte}`}
              >
                {a}
              </Badge>
            ) : a === "RESP. CLIENTE" ? (
              <Badge key={a} variant="outline" className="text-[10px]">
                {a}
              </Badge>
            ) : a === "TDE" ? (
              <Badge
                key={a}
                variant="outline"
                className="border-amber-500/60 text-[10px] text-amber-700 dark:text-amber-400"
                title={`TDE (taxa de dificuldade de entrega): ${fmtMoeda(l.tde)}`}
              >
                TDE
              </Badge>
            ) : (
              <Badge key={a} variant="secondary" className="text-[10px]">
                {a}
              </Badge>
            ),
          )}
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
      <Badge variant="secondary" className="text-[10px]">
        Resp. cliente
      </Badge>
    );
  }
  if (dias > 0) {
    return (
      <span className="font-medium text-destructive" title={`fonte: ${fonte}`}>
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
      <span className="font-medium text-emerald-600">No prazo</span>
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
  return (
    <>
      <tr className="border-y border-border/70 bg-muted/30">
        <td colSpan={COLUNAS_ANTES_DO_PESO} className="sticky left-0 z-[5] bg-muted/30 px-3 py-1.5">
          <button
            type="button"
            aria-expanded={aberto}
            onClick={() => {
              setAberto((a) => !a);
            }}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium"
          >
            {aberto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {rotulo}
            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
              {nfInt.format(soma.ctes)} notas
            </span>
          </button>
        </td>
        <td className="px-3 py-1.5 text-right text-[12px] font-medium tabular-nums">
          {fmtPeso(soma.peso)}
        </td>
        <td className="px-3 py-1.5 text-right text-[12px] font-medium tabular-nums">
          {nfInt.format(soma.volumes)}
        </td>
        <td className="px-3 py-1.5 text-right text-[12px] font-medium tabular-nums">
          {fmtMoeda(soma.frete)}
        </td>
        <td colSpan={COLUNAS_DA_TABELA - COLUNAS_ANTES_DO_PESO - 3} />
      </tr>
      {aberto && linhas.map((l) => children(l))}
    </>
  );
}

function LinhasCarregando() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i} className="border-b border-border/40">
          {Array.from({ length: 20 }, (__, j) => (
            <td key={j} className="px-3 py-2">
              <div className="h-3 w-full animate-pulse rounded bg-muted/60" />
            </td>
          ))}
        </tr>
      ))}
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
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Ver linha do tempo de ocorrências"
          aria-label={`Linha do tempo do CTRC ${numero}`}
        >
          <History className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[420px] p-0">
        <div className="border-b border-border/70 px-3 py-2 text-[12px] font-medium">
          Linha do tempo · {numero}
        </div>
        <div className="max-h-[320px] overflow-y-auto p-3">
          {q.isLoading && <div className="text-[12px] text-muted-foreground">Carregando…</div>}
          {q.isError && (
            <div className="text-[12px] text-destructive">{mensagemAmigavel(q.error)}</div>
          )}
          {q.isSuccess && eventos.length === 0 && (
            <div className="text-[12px] text-muted-foreground">Sem ocorrências registradas.</div>
          )}
          <ol className="space-y-2">
            {eventos.map((e, i) => (
              <li key={i} className="border-l-2 border-border/70 pl-3 text-[12px]">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="tabular-nums">{formatarDataHora(e.dataHora)}</span>
                  {e.codigo && (
                    <Badge variant="outline" className="text-[10px]">
                      {e.codigo}
                    </Badge>
                  )}
                  <span className="ml-auto">{e.fonte === "ssw" ? "SSW" : "sistema"}</span>
                </div>
                <div className="text-foreground">{e.descricao ?? "—"}</div>
                {e.complemento && (
                  <div className="text-[11px] text-muted-foreground">{e.complemento}</div>
                )}
                {(e.unidade ?? e.usuario) && (
                  <div className="text-[11px] text-muted-foreground">
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
