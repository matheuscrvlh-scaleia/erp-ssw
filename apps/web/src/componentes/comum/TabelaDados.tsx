import { ArrowDown, ArrowUp, ArrowUpDown, Columns3 } from "lucide-react";
import { type KeyboardEvent, type ReactNode, useMemo, useState } from "react";

import { Button } from "@/componentes/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/componentes/ui/dropdown-menu";
import { type ColunaExportacao, textoDaCelula } from "@/lib/exportacao";
import { cn } from "@/lib/utils";

import { BotoesDePagina } from "./BotoesDePagina";
import { EstadoVazio } from "./EstadoVazio";
import { ExportMenu, type ExportMenuProps } from "./ExportMenu";
import { MensagemErro } from "./MensagemErro";
import {
  alinhamentoDa,
  type ColunaTabela,
  fatiarPagina,
  type Ordenacao,
  ordenarLinhas,
  proximaOrdenacao,
  totalDePaginas,
  valorDaColuna,
} from "./tabela-dados";

export type { ColunaTabela, Direcao, Ordenacao } from "./tabela-dados";

const inteiro = new Intl.NumberFormat("pt-BR");
const ALINHAR = { esquerda: "text-left", direita: "text-right", centro: "text-center" } as const;

type LinhaExportada = Record<string, unknown>;

export interface PaginacaoServidor {
  /** Página atual, a partir de 1. */
  pagina: number;
  porPagina: number;
  total: number;
  aoMudarPagina: (pagina: number) => void;
}

export interface TabelaDadosProps<T extends object> {
  colunas: readonly ColunaTabela<T>[];
  /** Todas as linhas (paginação no cliente) ou a página atual (`paginacaoServidor`). */
  linhas: readonly T[];
  chaveDaLinha: (linha: T) => string;
  /** Linha vira botão (Enter/Espaço também abrem). */
  aoClicarLinha?: ((linha: T) => void) | undefined;
  /** Chave da linha em destaque (ex.: a aberta na gaveta). */
  linhaAtiva?: string | null | undefined;
  carregando?: boolean | undefined;
  erro?: unknown;
  aoTentarDeNovo?: (() => void) | undefined;
  /** Padrão: "Nenhum registro encontrado." */
  mensagemVazia?: string | undefined;
  /** Linhas por página no cliente (padrão 50; 0 = tudo). */
  porPagina?: number | undefined;
  paginacaoServidor?: PaginacaoServidor | undefined;
  ordenacaoInicial?: Ordenacao | null | undefined;
  /** Ordenação controlada (feita no servidor): a tabela não reordena, só avisa. */
  ordenacao?: Ordenacao | null | undefined;
  aoOrdenar?: ((ordenacao: Ordenacao) => void) | undefined;
  /** Título da faixa de cima (estilo `label-xs`). */
  titulo?: string | undefined;
  /** Controles à direita do título (busca, seletores). */
  acoes?: ReactNode;
  /** Mostra o seletor "Colunas" (mostrar/esconder). */
  configurarColunas?: boolean | undefined;
  /** Botão Exportar com as colunas visíveis, na ordem da tela. */
  exportacao?:
    | (Omit<ExportMenuProps<LinhaExportada>, "colunas" | "linhas" | "carregarLinhas"> & {
        carregarLinhas?: (() => Promise<readonly T[]>) | undefined;
      })
    | undefined;
  /** Texto do total no rodapé. Padrão: "N registro(s)". */
  rotuloTotal?: ((total: number) => string) | undefined;
  className?: string | undefined;
}

function IconeOrdem({ direcao }: { direcao: Ordenacao["direcao"] | null }) {
  if (!direcao) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-50" aria-hidden />;
  return direcao === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" aria-hidden />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" aria-hidden />
  );
}

function SeletorDeColunas<T>({
  colunas,
  ocultas,
  alternar,
}: {
  colunas: readonly ColunaTabela<T>[];
  ocultas: ReadonlySet<string>;
  alternar: (chave: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-[12px]" data-exportacao-ignorar>
          <Columns3 className="mr-1.5 h-3 w-3" aria-hidden />
          Colunas
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
        <DropdownMenuLabel className="text-[11px]">Colunas visíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {colunas.map((c) => (
          <DropdownMenuCheckboxItem
            key={c.chave}
            className="text-[12px]"
            checked={!ocultas.has(c.chave)}
            disabled={c.fixa}
            onCheckedChange={() => {
              alternar(c.chave);
            }}
            // Continua aberto para ligar/desligar várias de uma vez.
            onSelect={(e) => {
              e.preventDefault();
            }}
          >
            {c.titulo}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Tabela padrão do painel: ordenação pelo cabeçalho, paginação (cliente ou servidor), linha
 * clicável, colunas configuráveis, carregando/erro/vazio e rodapé com o total.
 * origem: ColetasLista.tsx / CtrcsTable.tsx (sistema atual)
 */
export function TabelaDados<T extends object>(props: TabelaDadosProps<T>) {
  const {
    colunas,
    linhas,
    chaveDaLinha,
    aoClicarLinha,
    linhaAtiva,
    carregando,
    erro,
    aoTentarDeNovo,
    mensagemVazia = "Nenhum registro encontrado.",
    porPagina = 50,
    paginacaoServidor,
    ordenacaoInicial = null,
    aoOrdenar,
    titulo,
    acoes,
    configurarColunas,
    exportacao,
    rotuloTotal = (n: number) => `${inteiro.format(n)} registro(s)`,
    className,
  } = props;

  const [ordemLocal, setOrdemLocal] = useState<Ordenacao | null>(ordenacaoInicial);
  const ordenacao = aoOrdenar ? (props.ordenacao ?? null) : ordemLocal;
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(
    () => new Set(colunas.filter((c) => c.oculta).map((c) => c.chave)),
  );
  const [paginaLocal, setPaginaLocal] = useState(1);
  // Lista nova (filtro mudou) volta para a primeira página.
  const [linhasAnteriores, setLinhasAnteriores] = useState(linhas);
  if (linhas !== linhasAnteriores) {
    setLinhasAnteriores(linhas);
    setPaginaLocal(1);
  }

  const visiveis = colunas.filter((c) => !ocultas.has(c.chave));
  const ordenadas = useMemo(
    () =>
      aoOrdenar || !ordenacao
        ? linhas
        : ordenarLinhas(
            linhas,
            colunas.find((c) => c.chave === ordenacao.chave),
            ordenacao.direcao,
          ),
    [linhas, colunas, ordenacao, aoOrdenar],
  );

  const pagina = paginacaoServidor
    ? { linhas: ordenadas, pagina: paginacaoServidor.pagina }
    : fatiarPagina(ordenadas, paginaLocal, porPagina);
  const total = paginacaoServidor?.total ?? linhas.length;
  const paginas = paginacaoServidor
    ? totalDePaginas(paginacaoServidor.total, paginacaoServidor.porPagina)
    : totalDePaginas(linhas.length, porPagina);
  const irPara = (p: number) => {
    if (paginacaoServidor) paginacaoServidor.aoMudarPagina(p);
    else setPaginaLocal(p);
  };

  const ordenarPor = (chave: string) => {
    const proxima = proximaOrdenacao(ordenacao, chave);
    if (aoOrdenar) aoOrdenar(proxima);
    else setOrdemLocal(proxima);
    if (!paginacaoServidor) setPaginaLocal(1);
  };

  const alternarColuna = (chave: string) => {
    setOcultas((atual) => {
      const nova = new Set(atual);
      if (nova.has(chave)) nova.delete(chave);
      else nova.add(chave);
      return nova;
    });
  };

  const exportaveis = visiveis.filter((c) => !c.semExportar);
  const colunasExportacao: ColunaExportacao[] = exportaveis.map((c) => ({
    chave: c.chave,
    titulo: c.titulo,
    formato: c.formato,
  }));
  const paraExportar = (lista: readonly T[]): LinhaExportada[] =>
    lista.map((linha) =>
      Object.fromEntries(exportaveis.map((c) => [c.chave, valorDaColuna(c, linha)])),
    );

  const teclaNaLinha = (evento: KeyboardEvent, linha: T) => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault();
      aoClicarLinha?.(linha);
    }
  };

  const temFaixa = Boolean(titulo || acoes || configurarColunas || exportacao);
  const vazio = !carregando && !erro && pagina.linhas.length === 0;

  return (
    <div className={cn("rounded-[10px] border border-border/70 bg-card", className)}>
      {temFaixa && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
          {titulo && <h2 className="label-xs mr-2">{titulo}</h2>}
          {acoes}
          <div className="ml-auto flex items-center gap-2">
            {configurarColunas && (
              <SeletorDeColunas colunas={colunas} ocultas={ocultas} alternar={alternarColuna} />
            )}
            {exportacao && (
              <ExportMenu
                {...exportacao}
                colunas={colunasExportacao}
                linhas={paraExportar(ordenadas)}
                carregarLinhas={
                  exportacao.carregarLinhas
                    ? async () => {
                        const todas = await exportacao.carregarLinhas?.();
                        return paraExportar(todas ?? []);
                      }
                    : undefined
                }
              />
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-[12px]" aria-busy={carregando}>
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              {visiveis.map((c) => {
                const ativa = ordenacao?.chave === c.chave ? ordenacao.direcao : null;
                const ordenavel = c.ordenavel ?? true;
                return (
                  <th
                    key={c.chave}
                    scope="col"
                    className={cn("px-3 py-2 font-medium", ALINHAR[alinhamentoDa(c)])}
                    aria-sort={
                      ativa === "asc" ? "ascending" : ativa === "desc" ? "descending" : undefined
                    }
                  >
                    {ordenavel ? (
                      <button
                        type="button"
                        onClick={() => {
                          ordenarPor(c.chave);
                        }}
                        className="inline-flex items-center whitespace-nowrap text-[11px] font-medium hover:text-foreground"
                      >
                        {c.titulo}
                        <IconeOrdem direcao={ativa} />
                      </button>
                    ) : (
                      <span className="whitespace-nowrap text-[11px]">{c.titulo}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr>
                <td
                  colSpan={visiveis.length}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Carregando…
                </td>
              </tr>
            )}
            {!carregando && erro !== undefined && erro !== null && (
              <tr>
                <td colSpan={visiveis.length}>
                  <MensagemErro erro={erro} aoTentarDeNovo={aoTentarDeNovo} />
                </td>
              </tr>
            )}
            {vazio && (
              <tr>
                <td colSpan={visiveis.length}>
                  <EstadoVazio mensagem={mensagemVazia} />
                </td>
              </tr>
            )}
            {!carregando &&
              !erro &&
              pagina.linhas.map((linha) => {
                const chave = chaveDaLinha(linha);
                return (
                  <tr
                    key={chave}
                    className={cn(
                      "border-b border-border/40 last:border-0 hover:bg-muted/60",
                      aoClicarLinha &&
                        "cursor-pointer focus-visible:bg-muted/60 focus-visible:outline-none",
                      linhaAtiva === chave && "bg-muted/60",
                    )}
                    {...(aoClicarLinha
                      ? {
                          tabIndex: 0,
                          onClick: () => {
                            aoClicarLinha(linha);
                          },
                          onKeyDown: (e: KeyboardEvent) => {
                            teclaNaLinha(e, linha);
                          },
                        }
                      : {})}
                  >
                    {visiveis.map((c) => (
                      <td
                        key={c.chave}
                        className={cn("px-3 py-2", ALINHAR[alinhamentoDa(c)], c.classe)}
                      >
                        {c.celula
                          ? c.celula(linha)
                          : textoDaCelula(valorDaColuna(c, linha), c.formato) || "—"}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5 text-[12px]">
        <span className="text-muted-foreground" aria-live="polite">
          {rotuloTotal(total)}
          {paginas > 1 && ` · Página ${String(pagina.pagina)} de ${String(paginas)}`}
        </span>
        {paginas > 1 && (
          <div className="flex gap-2">
            <BotoesDePagina pagina={pagina.pagina} totalDePaginas={paginas} aoMudar={irPara} />
          </div>
        )}
      </div>
    </div>
  );
}
