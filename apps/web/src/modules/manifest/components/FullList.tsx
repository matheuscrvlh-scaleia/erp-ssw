/**
 * Lista da aba Total: situação, "Em rota agora", status, busca, agrupamento, seleção para
 * exportar, tabela e paginação. Visual da tela de hoje (routes/_authenticated/romaneio.tsx).
 */
import { grupoDaLinha } from "@erp/domain/manifest/row";
import {
  type EntradaLista,
  type FiltrosRomaneio,
  type LinhaLista,
  type OrdemLista,
  TAMANHOS_DE_PAGINA,
} from "@erp/shared/contracts/manifest";
import { formatarData } from "@erp/shared/formatting";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { BotoesDePagina } from "@/components/common/PageButtons";
import { Painel } from "@/components/common/Panel";
import { useAbrirCte } from "@/hooks/use-open-cte";

import { consultaLista, exportarLista } from "../api";
import { linhaParaExportar } from "../export";
import {
  alternarLinha,
  alternarTodas,
  estadoDoCabecalho,
  estaMarcada,
  proximaOrdem,
  quantasMarcadas,
  type Selecao,
  selecaoInicial,
} from "../rules";
import { type BuscaRomaneio, recorteEfetivo, tamanhoDePagina } from "../search";
import { COLUNAS_DA_TABELA } from "../texts";
import { FiltrosDaLista } from "./ListFilters";
import { GrupoDaLista } from "./ListGroup";
import { CabecalhoDaLista } from "./ListHeader";
import { LinhaDaLista } from "./ListRow";
import { SeletorDaLista } from "./ListSelector";
import { TabelaPropria } from "./OwnTable";
import { EstadoDaTabela } from "./TableState";

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
        <FiltrosDaLista
          busca={b}
          definir={definir}
          filtros={filtros}
          otifVisivel={otifVisivel}
          total={total}
          cabecalho={cabecalho}
          marcadas={marcadas}
          aoMarcarTodas={() => {
            setSelecao(selecaoInicial(chaveDosFiltros));
          }}
          carregarParaExportar={carregarParaExportar}
          carregando={q.isLoading}
        />
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
        <CabecalhoDaLista
          ordem={ordem}
          cabecalho={cabecalho}
          aoAlternarTodas={() => {
            setSelecao(alternarTodas(selecao));
          }}
          semLinhas={linhas.length === 0}
        />
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
                <LinhaDaLista
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
                <GrupoDaLista
                  key={g.chave}
                  rotulo={g.rotulo}
                  linhas={g.linhas}
                  subtotal={g.subtotal}
                >
                  {(l) => (
                    <LinhaDaLista
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
                </GrupoDaLista>
              ))}
        </tbody>
      </TabelaPropria>
    </Painel>
  );
}
